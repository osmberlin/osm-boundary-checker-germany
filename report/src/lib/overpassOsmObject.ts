import {
  overpassDocEnvelopeSchema,
  parseOverpassBoundaryData,
  type OverpassGeoJsonFeature,
} from './overpassBbox'

/** OSM element types the live-object lookup supports (areas and boundaries). */
type LiveOsmObjectType = 'way' | 'relation'

export type LiveOsmObjectRef = { type: LiveOsmObjectType; id: number }

/** Stable map key for one OSM object, e.g. `relation/123`. */
export type LiveOsmObjectKey = string

export function liveOsmObjectKey(type: string, id: number | string): LiveOsmObjectKey {
  return `${type}/${id}`
}

/** Overpass QL: one element by type and id with its tags and geometry. */
export function buildOverpassObjectQuery(ref: LiveOsmObjectRef): string {
  return `[out:json][timeout:25];
${ref.type}(${ref.id});
out geom;`
}

export type ParsedOverpassObject = {
  /** `null` when the element no longer exists (deleted) or carries no tags. */
  tags: Record<string, string> | null
  /** Geometry features in the same shape as the bbox boundary results. */
  features: OverpassGeoJsonFeature[]
}

export function parseOverpassObjectData(
  jsonText: string,
  ref: LiveOsmObjectRef,
): ParsedOverpassObject {
  let json: unknown
  try {
    json = JSON.parse(jsonText)
  } catch {
    throw new Error('INVALID_OVERPASS_JSON')
  }
  const doc = overpassDocEnvelopeSchema.safeParse(json)
  if (!doc.success) throw new Error('INVALID_OVERPASS_JSON')
  const element = (doc.data.elements ?? []).find((el) => el.type === ref.type && el.id === ref.id)
  if (!element) return { tags: null, features: [] }
  const tags = element.tags && Object.keys(element.tags).length > 0 ? element.tags : null
  // Tags come from the element itself so an object without renderable geometry still shows them.
  const features = tags ? parseOverpassBoundaryData(jsonText).geojson.features : []
  return { tags, features }
}

/** Combines feature collections, keeping the first feature per OSM object. */
export function mergeOverpassGeojson(
  collections: ReadonlyArray<{ features: OverpassGeoJsonFeature[] } | null>,
): { type: 'FeatureCollection'; features: OverpassGeoJsonFeature[] } | null {
  const seen = new Set<string>()
  const features: OverpassGeoJsonFeature[] = []
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
