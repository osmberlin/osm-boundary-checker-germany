import { lineString, multiLineString, multiPolygon, polygon } from '@turf/helpers'
import osm2geojson from 'osm2geojson-ultra'
import { z } from 'zod'
import {
  ALLOWED_OVERPASS_INTERPRETER_URLS,
  DEFAULT_OVERPASS_INTERPRETER_URL,
} from './overpassServers'

const MAX_QUERY_LEN = 48_000

/**
 * Overpass QL: `boundary=<tag>` relation/way features intersecting bbox (no extra tag filters).
 * Bbox: WGS84 [west, south, east, north] in degrees.
 */
export function buildOverpassBoundaryQuery(
  bbox: [number, number, number, number],
  boundaryTag: 'administrative' | 'postal_code' = 'administrative',
): string {
  const [west, south, east, north] = bbox
  const s = south
  const w = west
  const n = north
  const e = east
  return `[out:json][timeout:90];
(
  relation["boundary"="${boundaryTag}"](${s},${w},${n},${e});
  way["boundary"="${boundaryTag}"](${s},${w},${n},${e});
);
out geom;`
}

type OverpassLatLon = {
  lat: number
  lon: number
}

type OverpassMember = {
  type?: string
  role?: string
  geometry?: OverpassLatLon[]
}

type OverpassElement = {
  type: string
  id: number
  tags?: Record<string, string>
  geometry?: OverpassLatLon[]
  members?: OverpassMember[]
}

type OverpassDoc = {
  elements?: OverpassElement[]
  type?: unknown
  features?: unknown
}

export type OverpassBoundaryHit = {
  type: 'relation' | 'way' | string
  id: number
  tags: Record<string, string>
}

type OverpassGeoJsonProperties = {
  id: number
  type: string
  label: string
  relation_id?: number
  way_id?: number
  name?: string
  admin_level?: string
  boundary?: string
  postal_code?: string
}

type OverpassPolygonFeature = ReturnType<typeof polygon<OverpassGeoJsonProperties>>
type OverpassMultiPolygonFeature = ReturnType<typeof multiPolygon<OverpassGeoJsonProperties>>
type OverpassLineStringFeature = ReturnType<typeof lineString<OverpassGeoJsonProperties>>
type OverpassMultiLineStringFeature = ReturnType<typeof multiLineString<OverpassGeoJsonProperties>>

export type OverpassGeoJsonFeature =
  | OverpassPolygonFeature
  | OverpassMultiPolygonFeature
  | OverpassLineStringFeature
  | OverpassMultiLineStringFeature

export type OverpassGeoJsonFeatureCollection = {
  type: 'FeatureCollection'
  features: OverpassGeoJsonFeature[]
}

export type ParsedOverpassBoundaryData = {
  hits: OverpassBoundaryHit[]
  geojson: OverpassGeoJsonFeatureCollection
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

const RawFeaturePropertiesSchema = z.looseObject({
  '@id': z.union([z.coerce.number(), z.string()]).optional(),
  '@type': z.string().optional(),
  id: z.union([z.coerce.number(), z.string()]).optional(),
  osm_id: z.coerce.number().optional(),
  relation_id: z.coerce.number().optional(),
  way_id: z.coerce.number().optional(),
  type: z.string().optional(),
  label: z.string().optional(),
  name: z.string().optional(),
  admin_level: z.string().optional(),
  boundary: z.string().optional(),
  postal_code: z.string().optional(),
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

function normalizeFeatureProperties(raw: unknown): OverpassGeoJsonProperties | null {
  const parsed = RawFeaturePropertiesSchema.safeParse(raw)
  if (!parsed.success) return null
  const props = parsed.data
  const tags: Record<string, string> = props.tags ?? {}
  // osm2geojson-ultra uses @type/@id for non-tag element metadata.
  const atIdRef = parseOsmRef(props['@id'])
  const idRef = parseOsmRef(props.id)
  const typeFromField = props.type === 'relation' || props.type === 'way' ? props.type : null
  const type = props['@type'] ?? atIdRef.type ?? idRef.type ?? typeFromField ?? null
  const id =
    props.relation_id ??
    props.way_id ??
    atIdRef.id ??
    idRef.id ??
    (typeof props['@id'] === 'number' ? props['@id'] : null) ??
    (typeof props.id === 'number' ? props.id : null) ??
    props.osm_id ??
    null
  if (id == null) return null
  const relationId = props.relation_id ?? (type === 'relation' ? id : null)
  const wayId = props.way_id ?? (type === 'way' ? id : null)
  const labelCandidate = props.label && props.label.trim() !== '' ? props.label.trim() : null
  const label = labelCandidate ?? String(relationId ?? wayId ?? id)
  return {
    id,
    type: type ?? (relationId != null ? 'relation' : wayId != null ? 'way' : 'way'),
    label,
    ...(relationId != null ? { relation_id: relationId } : {}),
    ...(wayId != null ? { way_id: wayId } : {}),
    ...(props.name ? { name: props.name } : tags.name ? { name: tags.name } : {}),
    ...(props.admin_level
      ? { admin_level: props.admin_level }
      : tags.admin_level
        ? { admin_level: tags.admin_level }
        : {}),
    ...(props.boundary
      ? { boundary: props.boundary }
      : tags.boundary
        ? { boundary: tags.boundary }
        : {}),
    ...(props.postal_code
      ? { postal_code: props.postal_code }
      : tags.postal_code
        ? { postal_code: tags.postal_code }
        : {}),
  }
}

function normalizeFeature(raw: unknown): OverpassGeoJsonFeature | null {
  if (!isRecord(raw) || raw.type !== 'Feature' || !isRecord(raw.geometry)) return null
  const geometry = raw.geometry
  const props = normalizeFeatureProperties(raw.properties)
  if (!props) return null
  switch (geometry.type) {
    case 'Polygon':
      return polygon(geometry.coordinates as number[][][], props)
    case 'MultiPolygon':
      return multiPolygon(geometry.coordinates as number[][][][], props)
    case 'LineString':
      return lineString(geometry.coordinates as number[][], props)
    case 'MultiLineString':
      return multiLineString(geometry.coordinates as number[][][], props)
    default:
      return null
  }
}

function normalizeFeatureCollection(raw: unknown): OverpassGeoJsonFeatureCollection | null {
  if (!isRecord(raw) || raw.type !== 'FeatureCollection' || !Array.isArray(raw.features))
    return null
  const features = raw.features
    .map(normalizeFeature)
    .filter((f): f is OverpassGeoJsonFeature => f != null)
  return {
    type: 'FeatureCollection',
    features,
  }
}

function hitsFromElements(elements: OverpassElement[]): OverpassBoundaryHit[] {
  const hits: OverpassBoundaryHit[] = []
  for (const el of elements) {
    if (el.type !== 'relation' && el.type !== 'way') continue
    const tags = el.tags && typeof el.tags === 'object' ? el.tags : {}
    hits.push({ type: el.type, id: el.id, tags })
  }
  return hits
}

function hitsFromGeojson(geojson: OverpassGeoJsonFeatureCollection): OverpassBoundaryHit[] {
  return geojson.features.map((feature) => {
    const tags: Record<string, string> = {}
    if (feature.properties.name) tags.name = feature.properties.name
    if (feature.properties.admin_level) tags.admin_level = feature.properties.admin_level
    if (feature.properties.boundary) tags.boundary = feature.properties.boundary
    if (feature.properties.postal_code) tags.postal_code = feature.properties.postal_code
    const id = feature.properties.relation_id ?? feature.properties.way_id ?? feature.properties.id
    return {
      type: feature.properties.type,
      id,
      tags,
    }
  })
}

function hitKey(type: string, id: number): string {
  return `${type}:${id}`
}

function filterHitsToRenderedFeatures(
  hits: OverpassBoundaryHit[],
  geojson: OverpassGeoJsonFeatureCollection,
): OverpassBoundaryHit[] {
  const renderedKeys = new Set(
    geojson.features.map((feature) => {
      const id =
        feature.properties.relation_id ?? feature.properties.way_id ?? feature.properties.id
      return hitKey(feature.properties.type, id)
    }),
  )
  if (renderedKeys.size === 0) return []
  return hits.filter((hit) => renderedKeys.has(hitKey(hit.type, hit.id)))
}

export function parseOverpassBoundaryData(jsonText: string): ParsedOverpassBoundaryData {
  const parsed = JSON.parse(jsonText) as unknown
  if (!isRecord(parsed)) throw new Error('INVALID_OVERPASS_JSON')
  const overpassDoc = parsed as OverpassDoc
  const hits = Array.isArray(overpassDoc.elements) ? hitsFromElements(overpassDoc.elements) : []
  // This parser expects Overpass JSON and normalizes through osm2geojson-ultra.
  const convertedGeojson = normalizeFeatureCollection(osm2geojson(parsed))
  if (!convertedGeojson) throw new Error('INVALID_OVERPASS_JSON')
  const renderedHits = filterHitsToRenderedFeatures(hits, convertedGeojson)
  return {
    hits: hits.length > 0 ? renderedHits : hitsFromGeojson(convertedGeojson),
    geojson: convertedGeojson,
  }
}

export function parseOverpassBoundaryElements(jsonText: string): OverpassBoundaryHit[] {
  return parseOverpassBoundaryData(jsonText).hits
}

export async function fetchOverpassQuery(
  query: string,
  interpreterUrl: string = DEFAULT_OVERPASS_INTERPRETER_URL,
): Promise<Response> {
  if (!ALLOWED_OVERPASS_INTERPRETER_URLS.has(interpreterUrl)) {
    throw new Error('Interpreter not allowlisted')
  }
  if (query.length > MAX_QUERY_LEN) {
    throw new Error('Query too long')
  }
  const form = new URLSearchParams()
  form.set('data', query)
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
  }
  const requestInit: RequestInit = {
    method: 'POST',
    headers,
    body: form.toString(),
    // Browser request: send origin as referer to satisfy usage policy without leaking path/query.
    referrer: `${window.location.origin}/`,
    referrerPolicy: 'strict-origin-when-cross-origin',
  }
  return fetch(interpreterUrl, {
    ...requestInit,
  })
}

export async function fetchOverpassBoundaryInBbox(
  bbox: [number, number, number, number],
): Promise<Response> {
  return fetchOverpassQuery(buildOverpassBoundaryQuery(bbox))
}
