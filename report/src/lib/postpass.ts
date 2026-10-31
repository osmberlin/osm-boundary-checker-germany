import { z } from 'zod'
import { addrPostcodeColorIndex } from './addrPostcode'
import { addrPostcodeLiveRowKey, LIVE_ROW_KEY_PROPERTY } from './liveRowKey'

// The public Postpass service (https://github.com/woodpeck/postpass) answers SQL over HTTP. It is
// free and has no usage terms we could lean on, so this client stays small and careful: one request
// at a time per action, no retries, and every value in the SQL is a validated number or a constant.
const POSTPASS_URL = 'https://postpass.geofabrik.de/api/interpreter'
const TIMEOUT_MS = 20_000
/** Postpass sends neither a size nor compression: reading stops here. */
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024
export const MAX_NEARBY_OBJECTS = 500
export const MAX_ADDR_POSTCODE_OBJECTS = 20_000
/** About 8 m: enough for a map overlay, and a third of the data for a Bundesland. */
const OBJECT_SIMPLIFY_DEGREES = 0.0001

export const POSTPASS_INVALID_RESPONSE = 'POSTPASS_INVALID_RESPONSE'
export const POSTPASS_TIMEOUT = 'POSTPASS_TIMEOUT'
export const POSTPASS_TOO_MUCH_DATA = 'POSTPASS_TOO_MUCH_DATA'
export const POSTPASS_HTTP_ERROR_PREFIX = 'Postpass request failed:'

/** WGS84 [west, south, east, north] in degrees. */
export type Bbox = [number, number, number, number]

/** OSM element types the live-object lookup supports (areas and boundaries). */
type LiveOsmObjectType = 'way' | 'relation'

export type LiveOsmObjectRef = { type: LiveOsmObjectType; id: number }

/** Stable map key for one OSM object, e.g. `relation/123`. */
export type LiveOsmObjectKey = string

export function liveOsmObjectKey(type: string, id: number | string): LiveOsmObjectKey {
  return `${type}/${id}`
}

export type LiveOsmHit = { type: string; id: number; tags: Record<string, string> }

type LiveOsmFeatureProperties = {
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

export type LiveOsmFeature = GeoJSON.Feature<
  GeoJSON.Polygon | GeoJSON.MultiPolygon | GeoJSON.LineString | GeoJSON.MultiLineString,
  LiveOsmFeatureProperties
>

export type LiveOsmFeatureCollection = { type: 'FeatureCollection'; features: LiveOsmFeature[] }

type AddrPostcodeFeatureProperties = {
  id: number
  type: string
  label: string
  colorIndex: number
  node_id?: number
  way_id?: number
  [LIVE_ROW_KEY_PROPERTY]: string
}

export type AddrPostcodeFeature = GeoJSON.Feature<GeoJSON.Point, AddrPostcodeFeatureProperties>

export type AddrPostcodeFeatureCollection = {
  type: 'FeatureCollection'
  features: AddrPostcodeFeature[]
}

export type LiveOsmObjectResult = {
  /** `null` when Postpass does not know the object: deleted, or without tags. */
  tags: Record<string, string> | null
  /** `null` when the request asked for tags only. */
  features: LiveOsmFeature[] | null
  /** State of the OSM data, from Postpass. */
  timestamp: string
}

export type NearbyBoundariesResult = {
  hits: LiveOsmHit[]
  geojson: LiveOsmFeatureCollection
  timestamp: string
  truncated: boolean
}

export type AddrPostcodesResult = {
  hits: LiveOsmHit[]
  geojson: AddrPostcodeFeatureCollection
  timestamp: string
  truncated: boolean
}

type BoundaryTag = 'administrative' | 'postal_code' | 'protected_area'

/** `boundary` values behind an area's `overpassBoundaryTag` (protected areas include national parks). */
export function boundaryTagValues(boundaryTag: BoundaryTag): string[] {
  return boundaryTag === 'protected_area' ? ['protected_area', 'national_park'] : [boundaryTag]
}

const OSM_TYPES = { N: 'node', W: 'way', R: 'relation' } as const
const OSM_TYPE_LETTERS = { way: 'W', relation: 'R' } as const

const propertiesSchema = z.looseObject({ timestamp: z.string() })

const rowsResponseSchema = z.object({
  postpass_properties: propertiesSchema,
  result: z.array(z.object({ tags: z.record(z.string(), z.string()) })),
})

const featuresResponseSchema = z.object({
  postpass_properties: propertiesSchema,
  features: z.array(
    z.object({
      geometry: z.looseObject({ type: z.string() }).nullable(),
      properties: z.looseObject({
        osm_type: z.enum(['N', 'W', 'R']),
        osm_id: z.number(),
        tags: z.record(z.string(), z.string()).optional(),
        postcode: z.string().optional(),
      }),
    }),
  ),
})

function assertValidRef({ id }: LiveOsmObjectRef) {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Invalid OSM id')
}

function assertValidBbox([west, south, east, north]: Bbox) {
  const inRange =
    [west, south, east, north].every(Number.isFinite) &&
    west >= -180 &&
    east <= 180 &&
    south >= -90 &&
    north <= 90 &&
    west < east &&
    south < north
  if (!inRange) throw new Error('Invalid map area')
}

function envelope([west, south, east, north]: Bbox) {
  return `ST_MakeEnvelope(${west}, ${south}, ${east}, ${north}, 4326)`
}

/**
 * One object by type and id, which Postpass finds by index. An object can be a line and a polygon at
 * once, so one row is enough; the polygon wins when geometry is asked for. Postpass reads tags only
 * from `type=multipolygon|boundary|route` relations and leaves the tag `type` itself out.
 */
export function liveOsmObjectSql(ref: LiveOsmObjectRef, { geometry }: { geometry: boolean }) {
  assertValidRef(ref)
  const where = `osm_type = '${OSM_TYPE_LETTERS[ref.type]}' AND osm_id = ${ref.id}`
  if (!geometry) return `SELECT tags FROM postpass_linepolygon WHERE ${where} LIMIT 1`
  return `SELECT osm_type, osm_id, tags,
  ST_SimplifyPreserveTopology(geom, ${OBJECT_SIMPLIFY_DEGREES}) AS geom
FROM postpass_linepolygon
WHERE ${where}
ORDER BY ST_Dimension(geom) DESC
LIMIT 1`
}

/**
 * Boundaries in the map view, cut to it and as outlines: a cut polygon would close itself along the
 * edge of the view. Simplified to about a thousandth of the view, which a wide view needs most.
 */
export function nearbyBoundariesSql(bbox: Bbox, boundaryTag: BoundaryTag) {
  assertValidBbox(bbox)
  const box = envelope(bbox)
  const [west, south, east, north] = bbox
  const tolerance = Math.max(east - west, north - south) / 1000
  const values = boundaryTagValues(boundaryTag)
    .map((value) => `'${value}'`)
    .join(', ')
  return `SELECT osm_type, osm_id, tags,
  ST_CollectionExtract(ST_ClipByBox2D(ST_SimplifyPreserveTopology(ST_Boundary(geom), ${tolerance}), ${box}), 2) AS geom
FROM postpass_polygon
WHERE geom && ${box} AND tags->>'boundary' IN (${values})
LIMIT ${MAX_NEARBY_OBJECTS}`
}

/** Nodes and ways with `addr:postcode` in the map view; a way counts by a point on its area. */
export function addrPostcodesSql(bbox: Bbox) {
  assertValidBbox(bbox)
  const box = envelope(bbox)
  return `SELECT osm_type, osm_id, tags->>'addr:postcode' AS postcode, ST_PointOnSurface(geom) AS geom
FROM postpass_pointpolygon
WHERE geom && ${box} AND tags ? 'addr:postcode' AND osm_type IN ('N', 'W')
LIMIT ${MAX_ADDR_POSTCODE_OBJECTS}`
}

async function readLimited(response: Response) {
  if (!response.body) throw new Error(POSTPASS_INVALID_RESPONSE)
  const reader = response.body.getReader()
  const chunks: Uint8Array<ArrayBuffer>[] = []
  let bytes = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    bytes += value.byteLength
    if (bytes > MAX_RESPONSE_BYTES) {
      await reader.cancel()
      throw new Error(POSTPASS_TOO_MUCH_DATA)
    }
    chunks.push(value)
  }
  return new Blob(chunks).text()
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(POSTPASS_INVALID_RESPONSE)
  }
}

function parseResponse<T>(schema: z.ZodType<T>, text: string): T {
  const parsed = schema.safeParse(parseJson(text))
  if (!parsed.success) throw new Error(POSTPASS_INVALID_RESPONSE)
  return parsed.data
}

function hasCoordinates(geometry: { type?: unknown; coordinates?: unknown }) {
  return Array.isArray(geometry.coordinates) && geometry.coordinates.length > 0
}

const LIVE_OSM_GEOMETRY_TYPES = new Set([
  'Polygon',
  'MultiPolygon',
  'LineString',
  'MultiLineString',
])

function toLiveOsmFeature(
  feature: z.infer<typeof featuresResponseSchema>['features'][number],
): LiveOsmFeature | null {
  const { geometry, properties } = feature
  if (!geometry || !LIVE_OSM_GEOMETRY_TYPES.has(geometry.type) || !hasCoordinates(geometry)) {
    return null
  }
  const type = OSM_TYPES[properties.osm_type]
  const id = properties.osm_id
  const tags = properties.tags ?? {}
  return {
    type: 'Feature',
    geometry: geometry as unknown as LiveOsmFeature['geometry'],
    properties: {
      id,
      type,
      label: tags.name ?? String(id),
      ...(type === 'relation' ? { relation_id: id } : {}),
      ...(type === 'way' ? { way_id: id } : {}),
      ...(tags.name ? { name: tags.name } : {}),
      ...(tags.admin_level ? { admin_level: tags.admin_level } : {}),
      ...(tags.boundary ? { boundary: tags.boundary } : {}),
      ...(tags.postal_code ? { postal_code: tags.postal_code } : {}),
    },
  }
}

function nonEmptyTags(tags: Record<string, string> | undefined) {
  return tags && Object.keys(tags).length > 0 ? tags : null
}

export function parseLiveOsmObjectTags(text: string): LiveOsmObjectResult {
  const { postpass_properties, result } = parseResponse(rowsResponseSchema, text)
  return {
    tags: nonEmptyTags(result[0]?.tags),
    features: null,
    timestamp: postpass_properties.timestamp,
  }
}

export function parseLiveOsmObjectWithGeometry(text: string): LiveOsmObjectResult {
  const { postpass_properties, features } = parseResponse(featuresResponseSchema, text)
  const first = features[0]
  const liveFeature = first ? toLiveOsmFeature(first) : null
  return {
    tags: nonEmptyTags(first?.properties.tags),
    features: liveFeature ? [liveFeature] : [],
    timestamp: postpass_properties.timestamp,
  }
}

function hitOrder(type: string) {
  return type === 'relation' ? 0 : type === 'node' ? 1 : 2
}

function sortHits(hits: LiveOsmHit[]) {
  return hits.toSorted((a, b) => hitOrder(a.type) - hitOrder(b.type) || a.id - b.id)
}

/** Parses an answer. Clipping can leave nothing of an object: it then is no hit either. */
export function parseNearbyBoundaries(text: string): NearbyBoundariesResult {
  const { postpass_properties, features } = parseResponse(featuresResponseSchema, text)
  const hits: LiveOsmHit[] = []
  const liveFeatures: LiveOsmFeature[] = []
  for (const feature of features) {
    const liveFeature = toLiveOsmFeature(feature)
    if (!liveFeature) continue
    liveFeatures.push(liveFeature)
    hits.push({
      type: liveFeature.properties.type,
      id: liveFeature.properties.id,
      tags: feature.properties.tags ?? {},
    })
  }
  return {
    hits: sortHits(hits),
    geojson: { type: 'FeatureCollection', features: liveFeatures },
    timestamp: postpass_properties.timestamp,
    truncated: features.length >= MAX_NEARBY_OBJECTS,
  }
}

export function parseAddrPostcodes(text: string): AddrPostcodesResult {
  const { postpass_properties, features } = parseResponse(featuresResponseSchema, text)
  const hits: LiveOsmHit[] = []
  const points: AddrPostcodeFeature[] = []
  for (const { geometry, properties } of features) {
    const type = OSM_TYPES[properties.osm_type]
    const id = properties.osm_id
    const postcode = properties.postcode?.trim()
    if (!postcode || geometry?.type !== 'Point' || !hasCoordinates(geometry)) continue
    hits.push({ type, id, tags: { 'addr:postcode': postcode } })
    points.push({
      type: 'Feature',
      geometry: geometry as unknown as GeoJSON.Point,
      properties: {
        id,
        type,
        label: postcode,
        colorIndex: addrPostcodeColorIndex(postcode),
        [LIVE_ROW_KEY_PROPERTY]: addrPostcodeLiveRowKey(type, id),
        ...(type === 'node' ? { node_id: id } : {}),
        ...(type === 'way' ? { way_id: id } : {}),
      },
    })
  }
  return {
    hits: sortHits(hits),
    geojson: { type: 'FeatureCollection', features: points },
    timestamp: postpass_properties.timestamp,
    truncated: features.length >= MAX_ADDR_POSTCODE_OBJECTS,
  }
}

/** One request, no retry. Without geometry Postpass needs `geojson=false`. */
async function fetchPostpass(sql: string, { geojson }: { geojson: boolean }) {
  const url = new URL(POSTPASS_URL)
  url.searchParams.set('data', sql)
  if (!geojson) url.searchParams.set('options[geojson]', 'false')
  try {
    const response = await fetch(url, {
      credentials: 'omit',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!response.ok) throw new Error(`${POSTPASS_HTTP_ERROR_PREFIX} ${response.status}`)
    return await readLimited(response)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new Error(POSTPASS_TIMEOUT)
    }
    throw error
  }
}

export async function fetchLiveOsmObject(
  ref: LiveOsmObjectRef,
  { geometry }: { geometry: boolean },
): Promise<LiveOsmObjectResult> {
  const text = await fetchPostpass(liveOsmObjectSql(ref, { geometry }), { geojson: geometry })
  return geometry ? parseLiveOsmObjectWithGeometry(text) : parseLiveOsmObjectTags(text)
}

export async function fetchNearbyBoundaries(bbox: Bbox, boundaryTag: BoundaryTag) {
  const text = await fetchPostpass(nearbyBoundariesSql(bbox, boundaryTag), { geojson: true })
  return parseNearbyBoundaries(text)
}

export async function fetchAddrPostcodes(bbox: Bbox) {
  return parseAddrPostcodes(await fetchPostpass(addrPostcodesSql(bbox), { geojson: true }))
}

/** Combines feature collections, keeping the first feature per OSM object. */
export function mergeLiveOsmGeojson(
  collections: ReadonlyArray<{ features: LiveOsmFeature[] } | null>,
): LiveOsmFeatureCollection | null {
  const seen = new Set<string>()
  const features: LiveOsmFeature[] = []
  for (const collection of collections) {
    for (const feature of collection?.features ?? []) {
      const { type, id, relation_id, way_id } = feature.properties
      const key = liveOsmObjectKey(type, relation_id ?? way_id ?? id)
      if (seen.has(key)) continue
      seen.add(key)
      features.push(feature)
    }
  }
  return features.length > 0 ? { type: 'FeatureCollection', features } : null
}
