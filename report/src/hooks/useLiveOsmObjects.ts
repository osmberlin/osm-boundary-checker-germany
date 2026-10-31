import { useEffect, useMemo } from 'react'
import {
  liveOsmObjectKey,
  type LiveOsmFeatureCollection,
  type LiveOsmObjectRef,
} from '../lib/postpass'
import {
  useLiveOsmObjectActions,
  useLiveOsmObjectStates,
  type LiveOsmObjectState,
} from '../stores/liveOsmObjectsStore'

/**
 * Current OSM state of single objects of a page, fetched by type and id from Postpass.
 * Every component that calls this with the same `featureKey` sees the same loads.
 *
 * - `objects`: state per `type/id` (absent = not requested yet).
 * - `getState(ref)`: state of one object.
 * - `geojson`: geometry of all loaded objects, for the live map overlay (hide rows via
 *   `useLiveOverlayActions` with `liveOsmRowKey(type, id)`).
 * - `load(ref, { geometry })`: stored answer or a request (no-op while it is loading).
 * - `refresh(ref, { geometry })`: a new request, whatever is stored.
 */
export function useLiveOsmObjects(featureKey: string) {
  const objects = useLiveOsmObjectStates(featureKey)
  const { load } = useLiveOsmObjectActions()

  const geojson = useMemo((): LiveOsmFeatureCollection | null => {
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
    load: (ref: LiveOsmObjectRef, { geometry }: { geometry: boolean }) =>
      load(featureKey, ref, { geometry }),
    refresh: (ref: LiveOsmObjectRef, { geometry }: { geometry: boolean }) =>
      load(featureKey, ref, { geometry, refresh: true }),
  }
}

/** Loads the object of a page once it opens: from the store, or else from Postpass. */
export function useLoadLiveOsmObjectOnOpen(
  featureKey: string,
  ref: LiveOsmObjectRef | null,
  { geometry }: { geometry: boolean },
) {
  const { load } = useLiveOsmObjectActions()
  const type = ref?.type
  const id = ref?.id

  useEffect(
    function loadOnOpen() {
      if (type !== undefined && id !== undefined) {
        void load(featureKey, { type, id }, { geometry })
      }
    },
    [featureKey, type, id, geometry, load],
  )
}

/** Shows a stored answer of this object again, without a request: candidates load by click. */
export function useRestoreLiveOsmObject(featureKey: string, ref: LiveOsmObjectRef) {
  const { restore } = useLiveOsmObjectActions()
  const { type, id } = ref

  useEffect(
    function restoreStoredAnswer() {
      void restore(featureKey, { type, id })
    },
    [featureKey, type, id, restore],
  )
}
