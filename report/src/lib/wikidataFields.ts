import { normalizeAreaNameForCompare } from '../../../scripts/shared/attributeChecks.ts'
import type { WikidataShardItem } from '../../../scripts/shared/wikidataProtectedAreasPayload.ts'
import { formatDeFixed } from './formatDe'
import { parseReportRowOsmRef } from './osmObjectRef'

/** Wikidata area (P2046) and geometry area count as equal within this relative difference. */
const WIKIDATA_AREA_TOLERANCE = 0.05

export type WikidataFieldId =
  | 'label'
  | 'wdpa'
  | 'osmRelation'
  | 'website'
  | 'operator'
  | 'area'
  | 'commons'

/** A value of the official record or the OSM object that a Wikidata value is compared with. */
export type WikidataComparedValue = {
  source: 'official' | 'osm'
  key: string
  value: string
  /** Shown in the marker tooltip instead of the source name (e.g. "DtP-Geometrie"). */
  label?: string
}

export type WikidataFieldRow = {
  id: WikidataFieldId
  /** Wikidata values as text (operators as label or id). */
  values: string[]
  /** `equal` / `different` against what DtP and OSM say; `none` = nothing to compare. */
  status: 'equal' | 'different' | 'none'
  /** What DtP and OSM say, for the marker tooltip. */
  compared: WikidataComparedValue[]
  /** Value that could fill the property when Wikidata has none. */
  suggestion?: string
}

type Props = Record<string, unknown> | null

function text(raw: unknown): string {
  if (raw == null || typeof raw === 'object') return ''
  return String(raw).trim()
}

function parts(raw: unknown): string[] {
  return text(raw)
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part !== '')
}

/** The trimmed value as a one-item list, empty when there is none (keeps `;` inside names). */
function parts1(raw: unknown): string[] {
  const value = text(raw)
  return value === '' ? [] : [value]
}

/** Comparable website: no scheme, `www.`, query/fragment or trailing slash; lower case. */
export function normalizeWebsite(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '')
}

function compareValues(
  wikidata: readonly string[],
  others: readonly WikidataComparedValue[],
  normalize: (value: string) => string = (value) => value,
): WikidataFieldRow['status'] {
  if (wikidata.length === 0 || others.length === 0) return 'none'
  const known = new Set(wikidata.map(normalize))
  return others.some(({ value }) => known.has(normalize(value))) ? 'equal' : 'different'
}

function compared(
  source: WikidataComparedValue['source'],
  key: string,
  values: readonly string[],
): WikidataComparedValue[] {
  return values.map((value) => ({ source, key, value }))
}

/**
 * The fields of one Wikidata item next to what the official record and the matched OSM object say,
 * with a suggestion where Wikidata has no value but one of them does.
 */
export function wikidataFieldRows(
  item: WikidataShardItem,
  context: {
    official: Props
    osm: Props
    osmRelationId: string
    /** Area of the official geometry and of the matched OSM geometry in hectares, when known. */
    areaHa?: { official: number | null; osm: number | null }
    /** Name of the official geometry for the area tooltip ("DtP-Geometrie"). */
    officialGeometryLabel?: string
  },
): WikidataFieldRow[] {
  const { official, osm } = context
  const rows: WikidataFieldRow[] = []

  const labelValues = item.label ? [item.label] : []
  const names = [
    ...compared('official', 'name', parts1(official?.name)),
    ...compared('osm', 'name', parts1(osm?.name)),
    ...compared('osm', 'official_name', parts1(osm?.official_name)),
  ]
  rows.push({
    id: 'label',
    values: labelValues,
    status: compareValues(labelValues, names, normalizeAreaNameForCompare),
    compared: names,
    ...(labelValues.length === 0 && names[0] ? { suggestion: names[0].value } : {}),
  })

  const wdpaOthers = [
    ...compared('official', 'wdpa', parts(official?.wdpa)),
    ...compared('osm', 'ref:WDPA', parts(osm?.['ref:WDPA'])),
  ]
  const wdpa = item.wdpa ?? []
  rows.push({
    id: 'wdpa',
    values: wdpa,
    status: compareValues(wdpa, wdpaOthers),
    compared: wdpaOthers,
    ...(wdpa.length === 0 && wdpaOthers[0] ? { suggestion: wdpaOthers[0].value } : {}),
  })

  const relationId = parseReportRowOsmRef(context.osmRelationId)?.numericId
  const relationOthers = relationId ? compared('osm', '', [String(relationId)]) : []
  const relations = item.osmRelation ?? []
  rows.push({
    id: 'osmRelation',
    values: relations,
    status: compareValues(relations, relationOthers),
    compared: relationOthers,
    ...(relations.length === 0 && relationOthers[0] ? { suggestion: relationOthers[0].value } : {}),
  })

  const websiteKey =
    ['website', 'contact:website', 'url'].find((key) => text(osm?.[key]) !== '') ?? 'website'
  const websiteOthers = compared('osm', websiteKey, parts(osm?.[websiteKey]))
  const websites = item.website ?? []
  rows.push({
    id: 'website',
    values: websites,
    status: compareValues(websites, websiteOthers, normalizeWebsite),
    compared: websiteOthers,
    ...(websites.length === 0 && websiteOthers[0] ? { suggestion: websiteOthers[0].value } : {}),
  })

  const operators = (item.operator ?? []).map((operator) => operator.label ?? operator.qid)
  const operatorHint = text(osm?.operator) || text(official?.dtp_organizations)
  rows.push({
    id: 'operator',
    values: operators,
    status: 'none',
    compared: [],
    ...(operators.length === 0 && operatorHint ? { suggestion: operatorHint } : {}),
  })

  const officialAreaHa = context.areaHa?.official ?? null
  const osmAreaHa = context.areaHa?.osm ?? null
  const areaText = (ha: number) => `${formatDeFixed(ha, 2)} ha`
  const areaCompared: WikidataComparedValue[] =
    officialAreaHa === null
      ? []
      : [
          {
            source: 'official',
            key: '',
            value: areaText(officialAreaHa),
            ...(context.officialGeometryLabel ? { label: context.officialGeometryLabel } : {}),
          },
          ...(osmAreaHa === null
            ? []
            : [{ source: 'osm' as const, key: '', value: areaText(osmAreaHa) }]),
        ]
  rows.push({
    id: 'area',
    values: item.areaHa === undefined ? [] : [String(item.areaHa)],
    status:
      item.areaHa === undefined || officialAreaHa === null || officialAreaHa <= 0
        ? 'none'
        : Math.abs(item.areaHa - officialAreaHa) / officialAreaHa <= WIKIDATA_AREA_TOLERANCE
          ? 'equal'
          : 'different',
    compared: areaCompared,
    ...(item.areaHa === undefined && officialAreaHa !== null
      ? { suggestion: areaText(officialAreaHa) }
      : {}),
  })
  rows.push({
    id: 'commons',
    values: item.commons ? [item.commons] : [],
    status: 'none',
    compared: [],
  })
  return rows
}
