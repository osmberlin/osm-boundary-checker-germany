import { useMemo } from 'react'
import type { OverpassGeoJsonFeatureCollection } from '../lib/overpassBbox'
import { liveOsmObjectKey, type LiveOsmObjectRef } from '../lib/overpassOsmObject'
import {
  useLiveOsmObjectActions,
  useLiveOsmObjectStates,
  type LiveOsmObjectState,
} from '../stores/liveOsmObjectsStore'

/**
 * Current OSM state of single objects of a feature detail page, fetched by type and id from Overpass.
 * Every component that calls this with the same `featureKey` sees the same loads.
 *
 * - `objects`: state per `type/id` (absent = not requested yet).
 * - `getState(ref)`: state of one object.
 * - `geojson`: geometry of all loaded objects, for the Overpass map overlay (hide rows via
 *   `useLiveOverlayActions` with `overpassLiveRowKey(type, id)`).
 * - `load(ref)`: fetch the object (no-op while it is loading); `reset(ref)` forgets it.
 */
export function useLiveOsmObjects(featureKey: string) {
  const objects = useLiveOsmObjectStates(featureKey)
  const { load, reset } = useLiveOsmObjectActions()

  const geojson = useMemo((): OverpassGeoJsonFeatureCollection | null => {
    const features = Object.values(objects).flatMap((state) =>
      state.status === 'done' ? state.features : [],
    )
    return features.length > 0 ? { type: 'FeatureCollection', features } : null
  }, [objects])

  return {
    objects,
    getState: (ref: LiveOsmObjectRef): LiveOsmObjectState | undefined =>
      objects[liveOsmObjectKey(ref.type, ref.id)],
    geojson,
    load: (ref: LiveOsmObjectRef, interpreterUrl?: string) => load(featureKey, ref, interpreterUrl),
    reset: (ref: LiveOsmObjectRef) => reset(featureKey, ref),
  }
}
