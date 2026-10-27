import { overpassFeatureRowKey, type LiveRowKey } from '../lib/liveRowKey'
import type { OverpassGeoJsonFeatureCollection } from '../lib/overpassBbox'
import { useLiveOsmObjectStates, type LiveOsmObjectState } from '../stores/liveOsmObjectsStore'
import { useFeatureDetailOverpass } from './useFeatureDetailOverpass'

type ObjectStates = Readonly<Record<string, LiveOsmObjectState>>

/** No nearby search yet (WeakMap keys must be objects). */
const NO_NEARBY = {}

/**
 * Keys per (loaded objects, nearby result) pair. Both inputs are stable references (store record
 * and query data), so every toggle of the page shares one computation per change.
 */
const rowKeysCache = new WeakMap<ObjectStates, WeakMap<object, LiveRowKey[]>>()

function overpassRowKeys(
  objects: ObjectStates,
  nearby: OverpassGeoJsonFeatureCollection | null,
): LiveRowKey[] {
  const byNearby = rowKeysCache.get(objects) ?? new WeakMap<object, LiveRowKey[]>()
  rowKeysCache.set(objects, byNearby)
  const cached = byNearby.get(nearby ?? NO_NEARBY)
  if (cached) return cached
  const features = [
    ...Object.values(objects).flatMap((state) => (state.status === 'done' ? state.features : [])),
    ...(nearby?.features ?? []),
  ]
  const keys = [...new Set(features.flatMap((feature) => overpassFeatureRowKey(feature) ?? []))]
  byNearby.set(nearby ?? NO_NEARBY, keys)
  return keys
}

/** Row keys of all Overpass objects on the detail map: loaded by id plus the nearby search. */
export function useOverpassMapRowKeys(featureKey: string): LiveRowKey[] {
  const objects = useLiveOsmObjectStates(featureKey)
  const nearby = useFeatureDetailOverpass(featureKey)
  return overpassRowKeys(objects, nearby.geojson)
}
