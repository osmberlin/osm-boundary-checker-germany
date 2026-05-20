import type { AddrPostcodeGeoJsonFeature } from './overpassAddrPostcode'
import type { OverpassGeoJsonFeature } from './overpassBbox'

/**
 * Stable identifier for a single live result row (WFS feature card or Overpass hit card).
 * Used to mirror disclosure open/closed state into map overlay visibility.
 *
 * Prefix encodes the source so a single store action can target only one source
 * (e.g. "Hide all Overpass results") without tracking source membership separately.
 */
export type LiveRowKey = string

export function overpassLiveRowKey(type: string, id: number): LiveRowKey {
  return `overpass:${type}:${id}`
}

export function addrPostcodeLiveRowKey(type: string, id: number): LiveRowKey {
  return `addr-postcode:${type}:${id}`
}

export function wfsLiveRowKey(sourceId: string, idPart: string): LiveRowKey {
  return `wfs:${sourceId}:${idPart}`
}

/**
 * Stable idPart for a WFS feature within a single source, matching the React key
 * used in LiveSourceProperties. Falls back to 1-based index when the feature has no id.
 */
export function wfsFeatureIdPart(
  feature: { id?: string | number | null },
  indexInSource: number,
): string {
  return feature.id != null && feature.id !== '' ? String(feature.id) : String(indexInSource + 1)
}

/** Property key stamped onto live overlay GeoJSON features so the map can filter by row visibility. */
export const LIVE_ROW_KEY_PROPERTY = '__liveRowKey'

/** Read the row key from an Overpass GeoJSON feature, deriving it from `type` + best-available id. */
export function overpassFeatureRowKey(feature: OverpassGeoJsonFeature): LiveRowKey | null {
  const props = feature.properties
  if (!props) return null
  const id = props.relation_id ?? props.way_id ?? props.id
  if (id == null || !props.type) return null
  return overpassLiveRowKey(props.type, id)
}

/** Read stamped `__liveRowKey` or derive from addr:postcode live feature properties. */
export function addrPostcodeFeatureRowKey(feature: AddrPostcodeGeoJsonFeature): LiveRowKey | null {
  const props = feature.properties
  if (!props) return null
  const stamped = props[LIVE_ROW_KEY_PROPERTY]
  if (typeof stamped === 'string' && stamped.length > 0) return stamped
  const id = props.node_id ?? props.way_id ?? props.id
  if (id == null || !props.type) return null
  return addrPostcodeLiveRowKey(props.type, id)
}
