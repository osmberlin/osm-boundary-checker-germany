import { create } from 'zustand'
import { fetchOverpassQuery } from '../lib/overpassBbox'
import {
  buildOverpassObjectQuery,
  liveOsmObjectKey,
  parseOverpassObjectData,
  type LiveOsmObjectKey,
  type LiveOsmObjectRef,
  type ParsedOverpassObject,
} from '../lib/overpassOsmObject'
import { DEFAULT_OVERPASS_INTERPRETER_URL } from '../lib/overpassServers'

/**
 * Current OSM state of single objects (loaded by type and id from Overpass), per feature detail page.
 *
 * Keyed by `featureKey` (= ReportRow.canonicalMatchKey) so several components of one page share the
 * result of a load and navigating between pages does not leak objects. Memory only.
 */

type FeatureKey = string

export type LiveOsmObjectState =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | ({ status: 'done' } & ParsedOverpassObject)

type LiveOsmObjectsState = {
  byFeature: Record<FeatureKey, Readonly<Record<LiveOsmObjectKey, LiveOsmObjectState>>>
  actions: {
    load: (featureKey: FeatureKey, ref: LiveOsmObjectRef, interpreterUrl?: string) => Promise<void>
    reset: (featureKey: FeatureKey, ref: LiveOsmObjectRef) => void
  }
}

async function fetchLiveOsmObject(
  ref: LiveOsmObjectRef,
  interpreterUrl: string,
): Promise<ParsedOverpassObject> {
  const res = await fetchOverpassQuery(buildOverpassObjectQuery(ref), interpreterUrl)
  const text = await res.text()
  if (!res.ok) throw new Error(`Overpass request failed: ${res.status}`)
  return parseOverpassObjectData(text, ref)
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

  return {
    byFeature: {},
    actions: {
      load: async (featureKey, ref, interpreterUrl = DEFAULT_OVERPASS_INTERPRETER_URL) => {
        const key = liveOsmObjectKey(ref.type, ref.id)
        if (get().byFeature[featureKey]?.[key]?.status === 'loading') return
        setObject(featureKey, key, { status: 'loading' })
        try {
          const parsed = await fetchLiveOsmObject(ref, interpreterUrl)
          setObject(featureKey, key, { status: 'done', ...parsed })
        } catch (error) {
          setObject(featureKey, key, { status: 'error', error })
        }
      },
      reset: (featureKey, ref) =>
        set((state) => {
          const current = state.byFeature[featureKey]
          const key = liveOsmObjectKey(ref.type, ref.id)
          if (!current || !(key in current)) return state
          const rest = { ...current }
          delete rest[key]
          return { byFeature: { ...state.byFeature, [featureKey]: rest } }
        }),
    },
  }
})

const EMPTY_OBJECTS: Readonly<Record<LiveOsmObjectKey, LiveOsmObjectState>> = {}

/** Loaded objects of this page; same reference until one of them changes. */
export const useLiveOsmObjectStates = (featureKey: FeatureKey) =>
  useLiveOsmObjectsStore((state) => state.byFeature[featureKey] ?? EMPTY_OBJECTS)

/** Stable actions object — never causes re-renders. */
export const useLiveOsmObjectActions = () => useLiveOsmObjectsStore((state) => state.actions)
