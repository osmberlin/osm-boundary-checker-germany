import { point } from '@turf/helpers'
import osm2geojson from 'osm2geojson-ultra'
import { z } from 'zod'
import type { ComparisonForReport } from '../types/report'
import { addrPostcodeLiveRowKey, LIVE_ROW_KEY_PROPERTY } from './liveRowKey'
import { fetchOverpassQuery } from './overpassBbox'

/**
 * Digits-only PLZ; last digit → stable bucket 0–9 for map paint.
 * Neighboring PLZs with the same last digit share a color (acceptable v1 tradeoff).
 */
export function addrPostcodeColorIndex(postcode: string): number {
  const digits = postcode.replace(/\D/g, '')
  if (digits.length === 0) return 0
  return Number(digits[digits.length - 1]!) % 10
}

export function isPlzDatasetForReport(data: ComparisonForReport): boolean {
  return data.idNormalizationPreset === 'plz-5' || data.overpassBoundaryTag === 'postal_code'
}

/**
 * Overpass QL: nodes and ways with addr:postcode in bbox; way centroids via out center.
 * Bbox: WGS84 [west, south, east, north] in degrees.
 */
export function buildOverpassAddrPostcodeQuery(bbox: [number, number, number, number]): string {
  const [west, south, east, north] = bbox
  const s = south
  const w = west
  const n = north
  const e = east
  return `[out:json][timeout:90];
(
  node["addr:postcode"](${s},${w},${n},${e});
  way["addr:postcode"](${s},${w},${n},${e});
);
out center;`
}

export type AddrPostcodeHit = {
  type: 'node' | 'way' | string
  id: number
  tags: Record<string, string>
}

export type AddrPostcodeGeoJsonProperties = {
  id: number
  type: string
  label: string
  colorIndex: number
  node_id?: number
  way_id?: number
  [LIVE_ROW_KEY_PROPERTY]: string
}

type AddrPostcodePointFeature = ReturnType<typeof point<AddrPostcodeGeoJsonProperties>>

export type AddrPostcodeGeoJsonFeature = AddrPostcodePointFeature

export type AddrPostcodeGeoJsonFeatureCollection = {
  type: 'FeatureCollection'
  features: AddrPostcodeGeoJsonFeature[]
}

export type ParsedOverpassAddrPostcodeData = {
  hits: AddrPostcodeHit[]
  geojson: AddrPostcodeGeoJsonFeatureCollection
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

const RawFeaturePropertiesSchema = z.looseObject({
  '@id': z.union([z.coerce.number(), z.string()]).optional(),
  '@type': z.string().optional(),
  id: z.union([z.coerce.number(), z.string()]).optional(),
  osm_id: z.coerce.number().optional(),
  node_id: z.coerce.number().optional(),
  way_id: z.coerce.number().optional(),
  type: z.string().optional(),
  label: z.string().optional(),
  tags: z.record(z.string(), z.string()).optional(),
})

function parseOsmRef(value: unknown): {
  type: 'relation' | 'way' | 'node' | null
  id: number | null
} {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { type: null, id: value }
  }
  if (typeof value !== 'string') return { type: null, id: null }
  const trimmed = value.trim()
  const byPath = trimmed.match(/^(relation|way|node)\/(\d+)$/)
  if (!byPath) return { type: null, id: null }
  return {
    type: (byPath[1] as 'relation' | 'way' | 'node') ?? null,
    id: Number(byPath[2]),
  }
}

function postcodeLabelFromTags(tags: Record<string, string>): string {
  const pc = tags['addr:postcode']?.trim()
  if (pc) return pc
  return ''
}

function normalizeAddrPostcodeProperties(
  raw: unknown,
  rowKey: string,
): AddrPostcodeGeoJsonProperties | null {
  const parsed = RawFeaturePropertiesSchema.safeParse(raw)
  if (!parsed.success) return null
  const props = parsed.data
  const tags: Record<string, string> = props.tags ?? {}
  const atIdRef = parseOsmRef(props['@id'])
  const idRef = parseOsmRef(props.id)
  const typeFromField = props.type === 'node' || props.type === 'way' ? props.type : null
  const type = props['@type'] ?? atIdRef.type ?? idRef.type ?? typeFromField ?? null
  const id =
    props.node_id ??
    props.way_id ??
    atIdRef.id ??
    idRef.id ??
    (typeof props['@id'] === 'number' ? props['@id'] : null) ??
    (typeof props.id === 'number' ? props.id : null) ??
    props.osm_id ??
    null
  if (id == null || (type !== 'node' && type !== 'way')) return null
  const nodeId = props.node_id ?? (type === 'node' ? id : null)
  const wayId = props.way_id ?? (type === 'way' ? id : null)
  const labelFromTag = postcodeLabelFromTags(tags)
  const label =
    props.label && props.label.trim() !== ''
      ? props.label.trim()
      : labelFromTag !== ''
        ? labelFromTag
        : String(nodeId ?? wayId ?? id)
  const colorIndex = addrPostcodeColorIndex(label)
  return {
    id,
    type,
    label,
    colorIndex,
    [LIVE_ROW_KEY_PROPERTY]: rowKey,
    ...(nodeId != null ? { node_id: nodeId } : {}),
    ...(wayId != null ? { way_id: wayId } : {}),
  }
}

function normalizePointFeature(raw: unknown): AddrPostcodeGeoJsonFeature | null {
  if (!isRecord(raw) || raw.type !== 'Feature' || !isRecord(raw.geometry)) return null
  const geometry = raw.geometry
  if (geometry.type !== 'Point') return null
  const coords = geometry.coordinates
  if (!Array.isArray(coords) || coords.length < 2) return null
  const propsRaw = raw.properties
  const tags: Record<string, string> =
    isRecord(propsRaw) && isRecord(propsRaw.tags)
      ? (propsRaw.tags as Record<string, string>)
      : isRecord(propsRaw)
        ? Object.fromEntries(
            Object.entries(propsRaw).filter(
              (entry): entry is [string, string] =>
                typeof entry[1] === 'string' && !entry[0].startsWith('@'),
            ),
          )
        : {}
  const atIdRef = parseOsmRef(isRecord(propsRaw) ? propsRaw['@id'] : null)
  const type = (isRecord(propsRaw) ? propsRaw['@type'] : null) ?? atIdRef.type ?? 'node'
  const id =
    atIdRef.id ?? (isRecord(propsRaw) && typeof propsRaw.id === 'number' ? propsRaw.id : null)
  if (id == null || (type !== 'node' && type !== 'way')) return null
  const rowKey = addrPostcodeLiveRowKey(type, id)
  const mergedTags = { ...tags }
  if (!mergedTags['addr:postcode'] && isRecord(propsRaw)) {
    const direct = propsRaw['addr:postcode']
    if (typeof direct === 'string') mergedTags['addr:postcode'] = direct
  }
  const props = normalizeAddrPostcodeProperties(
    {
      ...(isRecord(propsRaw) ? propsRaw : {}),
      '@type': type,
      '@id': `${type}/${id}`,
      tags: mergedTags,
    },
    rowKey,
  )
  if (!props) return null
  return point(coords as [number, number], props)
}

function normalizeAddrPostcodeCollection(
  raw: unknown,
): AddrPostcodeGeoJsonFeatureCollection | null {
  if (!isRecord(raw) || raw.type !== 'FeatureCollection' || !Array.isArray(raw.features))
    return null
  const features = raw.features
    .map(normalizePointFeature)
    .filter((f): f is AddrPostcodeGeoJsonFeature => f != null)
  return { type: 'FeatureCollection', features }
}

type OverpassElement = {
  type: string
  id: number
  tags?: Record<string, string>
}

type OverpassDoc = {
  elements?: OverpassElement[]
}

function hitsFromElements(elements: OverpassElement[]): AddrPostcodeHit[] {
  const hits: AddrPostcodeHit[] = []
  for (const el of elements) {
    if (el.type !== 'node' && el.type !== 'way') continue
    const tags = el.tags && typeof el.tags === 'object' ? el.tags : {}
    if (!tags['addr:postcode']) continue
    hits.push({ type: el.type, id: el.id, tags })
  }
  return hits
}

function hitKey(type: string, id: number): string {
  return `${type}:${id}`
}

function filterHitsToRenderedFeatures(
  hits: AddrPostcodeHit[],
  geojson: AddrPostcodeGeoJsonFeatureCollection,
): AddrPostcodeHit[] {
  const renderedKeys = new Set(
    geojson.features.map((feature) => {
      const id = feature.properties.node_id ?? feature.properties.way_id ?? feature.properties.id
      return hitKey(feature.properties.type, id)
    }),
  )
  if (renderedKeys.size === 0) return []
  return hits.filter((hit) => renderedKeys.has(hitKey(hit.type, hit.id)))
}

function hitsFromGeojson(geojson: AddrPostcodeGeoJsonFeatureCollection): AddrPostcodeHit[] {
  return geojson.features.map((feature) => {
    const tags: Record<string, string> = {
      'addr:postcode': feature.properties.label,
    }
    const id = feature.properties.node_id ?? feature.properties.way_id ?? feature.properties.id
    return {
      type: feature.properties.type,
      id,
      tags,
    }
  })
}

export function parseOverpassAddrPostcodeData(jsonText: string): ParsedOverpassAddrPostcodeData {
  const parsed = JSON.parse(jsonText) as unknown
  if (!isRecord(parsed)) throw new Error('INVALID_OVERPASS_JSON')
  const overpassDoc = parsed as OverpassDoc
  const hits = Array.isArray(overpassDoc.elements) ? hitsFromElements(overpassDoc.elements) : []
  const convertedGeojson = normalizeAddrPostcodeCollection(osm2geojson(parsed))
  if (!convertedGeojson) throw new Error('INVALID_OVERPASS_JSON')
  const renderedHits = filterHitsToRenderedFeatures(hits, convertedGeojson)
  return {
    hits: hits.length > 0 ? renderedHits : hitsFromGeojson(convertedGeojson),
    geojson: convertedGeojson,
  }
}

export { fetchOverpassQuery }
