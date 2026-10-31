import { create } from 'zustand'
import { readLiveOsmCache, writeLiveOsmCache, type LiveOsmCacheEntry } from '../lib/liveOsmCache'
import {
  fetchLiveOsmObject,
  liveOsmObjectKey,
  type LiveOsmFeature,
  type LiveOsmObjectKey,
  type LiveOsmObjectRef,
  type LiveOsmObjectResult,
} from '../lib/postpass'

/**
 * Current OSM state of single objects (by type and id from Postpass), per page.
 *
 * Keyed by `featureKey` so the components of one page share a load and navigating between pages does
 * not leak objects onto the next map. The answers themselves live in `liveOsmCache`, by object.
 */

type FeatureKey = string

export type LiveOsmObjectState =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | {
      status: 'done'
      tags: Record<string, string> | null
      /** Geometry for the map overlay; empty for a page that only needs the tags. */
      features: LiveOsmFeature[]
      /** State of the OSM data, from Postpass. */
      timestamp: string
      /** When this browser asked Postpass. */
      loadedAt: number
    }

type LoadOptions = {
  /** Also fetch the geometry. Tags alone are a few KB, a Bundesland is 200 KB. */
  geometry: boolean
  /** Ask Postpass even when a stored answer is fresh. */
  refresh?: boolean
}

type LiveOsmObjectsState = {
  byFeature: Record<FeatureKey, Readonly<Record<LiveOsmObjectKey, LiveOsmObjectState>>>
  actions: {
    load: (featureKey: FeatureKey, ref: LiveOsmObjectRef, options: LoadOptions) => Promise<void>
    restore: (featureKey: FeatureKey, ref: LiveOsmObjectRef) => Promise<void>
  }
}

function cacheKey(ref: LiveOsmObjectRef) {
  return `object:${liveOsmObjectKey(ref.type, ref.id)}`
}

function doneState(
  entry: LiveOsmCacheEntry<LiveOsmObjectResult>,
  geometry: boolean,
): LiveOsmObjectState {
  const { tags, features, timestamp } = entry.value
  return {
    status: 'done',
    tags,
    features: geometry ? (features ?? []) : [],
    timestamp,
    loadedAt: entry.loadedAt,
  }
}

const useLiveOsmObjectsStore = create<LiveOsmObjectsState>((set, get) => {
  function setObject(featureKey: FeatureKey, key: LiveOsmObjectKey, value: LiveOsmObjectState) {
    set((state) => ({
      byFeature: {
        ...state.byFeature,
        [featureKey]: { ...state.byFeature[featureKey], [key]: value },
      },
    }))
  }

  function stateOf(featureKey: FeatureKey, key: LiveOsmObjectKey) {
    return get().byFeature[featureKey]?.[key]
  }

  return {
    byFeature: {},
    actions: {
      load: async (featureKey, ref, { geometry, refresh = false }) => {
        const key = liveOsmObjectKey(ref.type, ref.id)
        if (stateOf(featureKey, key)?.status === 'loading') return
        setObject(featureKey, key, { status: 'loading' })
        try {
          const stored = refresh ? null : await readLiveOsmCache<LiveOsmObjectResult>(cacheKey(ref))
          const usable = stored && (!geometry || stored.value.features !== null) ? stored : null
          const entry =
            usable ?? writeLiveOsmCache(cacheKey(ref), await fetchLiveOsmObject(ref, { geometry }))
          setObject(featureKey, key, doneState(entry, geometry))
        } catch (error) {
          setObject(featureKey, key, { status: 'error', error })
        }
      },
      restore: async (featureKey, ref) => {
        const key = liveOsmObjectKey(ref.type, ref.id)
        if (stateOf(featureKey, key)) return
        const stored = await readLiveOsmCache<LiveOsmObjectResult>(cacheKey(ref))
        // A tags-only answer stays hidden: this object's load button still has to fetch the geometry.
        if (stored && stored.value.features !== null && !stateOf(featureKey, key)) {
          setObject(featureKey, key, doneState(stored, true))
        }
      },
    },
  }
})

const EMPTY_OBJECTS: Readonly<Record<LiveOsmObjectKey, LiveOsmObjectState>> = {}

/** Loaded objects of this page; same reference until one of them changes. */
export const useLiveOsmObjectStates = (featureKey: FeatureKey) =>
  useLiveOsmObjectsStore((state) => state.byFeature[featureKey] ?? EMPTY_OBJECTS)

/** Stable actions object — never causes re-renders. */
export const useLiveOsmObjectActions = () => useLiveOsmObjectsStore((state) => state.actions)
