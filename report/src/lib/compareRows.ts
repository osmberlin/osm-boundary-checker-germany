import type { ComparisonForReport, ReportRow } from '../types/report'
import { normalizeUnmatchedRows } from './findFeatureDetailRow'
import { parseReportRowOsmRef } from './osmObjectRef'

/** Route id for `useParams({ from })` on the compare page. */
export const COMPARE_ROUTE_FROM = '/$areaId/compare/$officialKey/$osmKey' as const

type Bbox = [number, number, number, number]

function unionBbox(a: Bbox | null, b: Bbox | null): Bbox | null {
  if (!a) return b
  if (!b) return a
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]
}

/**
 * Readable name of a row. Official-only rows carry their key as `nameLabel`; the official name
 * field (`GEN` in BKG data, `name` elsewhere) is the better label next to an OSM name.
 */
export function rowDisplayName(row: ReportRow): string {
  if (row.nameLabel !== row.canonicalMatchKey) return row.nameLabel
  const name = row.officialProperties?.GEN ?? row.officialProperties?.name
  return typeof name === 'string' && name.trim() !== '' ? name.trim() : row.nameLabel
}

/** Unmatched OSM row of the dataset, or null when the key is not one. */
export function findUnmatchedOsmRow(data: ComparisonForReport, osmKey: string): ReportRow | null {
  return normalizeUnmatchedRows(data).find((row) => row.canonicalMatchKey === osmKey) ?? null
}

type CompareIndex = {
  officialOnlyKeys: ReadonlySet<string>
  unmatchedOsmKeys: ReadonlySet<string>
  unmatchedOsmKeyByRelationId: ReadonlyMap<string, string>
}

/** Built once per loaded comparison table, so lookups per candidate or visit stay cheap. */
const compareIndexCache = new WeakMap<ComparisonForReport, CompareIndex>()

function compareIndex(data: ComparisonForReport): CompareIndex {
  const cached = compareIndexCache.get(data)
  if (cached) return cached
  const unmatchedOsmKeyByRelationId = new Map<string, string>()
  for (const row of data.unmatchedOsm) {
    const ref = parseReportRowOsmRef(row.osmRelationId)
    if (ref) unmatchedOsmKeyByRelationId.set(String(ref.numericId), row.canonicalMatchKey)
  }
  const index: CompareIndex = {
    officialOnlyKeys: new Set(
      data.rows
        .filter((row) => row.category === 'official_only')
        .map((row) => row.canonicalMatchKey),
    ),
    unmatchedOsmKeys: new Set(data.unmatchedOsm.map((row) => row.canonicalMatchKey)),
    unmatchedOsmKeyByRelationId,
  }
  compareIndexCache.set(data, index)
  return index
}

/** Whether a key still has the category it had when it was visited (the nightly run may match it). */
export function isCompareSideKey(
  data: ComparisonForReport,
  category: 'official_only' | 'unmatched_osm',
  featureKey: string,
): boolean {
  const index = compareIndex(data)
  return (category === 'official_only' ? index.officialOnlyKeys : index.unmatchedOsmKeys).has(
    featureKey,
  )
}

/**
 * Key of the unmatched OSM row for an OSM relation, so a candidate or a nearby search hit can link
 * to a comparison. Null for ways and for relations the dataset matched or does not contain.
 */
export function unmatchedOsmKeyForObject(
  data: ComparisonForReport,
  osmType: string,
  osmId: string | number,
): string | null {
  if (osmType !== 'relation') return null
  return compareIndex(data).unmatchedOsmKeyByRelationId.get(String(osmId)) ?? null
}

/**
 * The official row with the OSM relation of the other side, as if the two were matched. Feeds the
 * attribute table (official properties vs. OSM tags) and the editor links (relation plus official
 * geometry) of the compare page.
 */
export function comparePairRow(official: ReportRow, osm: ReportRow): ReportRow {
  return {
    ...official,
    osmRelationId: osm.osmRelationId,
    osmProperties: osm.osmProperties,
    mapBbox: unionBbox(official.mapBbox, osm.mapBbox),
  }
}
