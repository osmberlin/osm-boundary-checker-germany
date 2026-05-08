import { create } from 'zustand'
import type { LiveRowKey } from '../lib/liveRowKey'

/**
 * Tracks which live result rows are hidden on the map for each feature detail page.
 *
 * Hidden-set model: default is "visible/open", so only closed rows live in state.
 * Keyed by `featureKey` (= ReportRow.canonicalMatchKey) so navigating between
 * feature detail pages does not leak visibility across rows.
 *
 * Memory only. Not persisted, not in URL.
 *
 * Followed Zustand best practices:
 * - Single store per concern, no provider, module-level.
 * - State + actions colocated; actions live under `state.actions` so consumers
 *   subscribe to `actions` once via `useLiveOverlayActions` and never re-render.
 * - Selectors return primitives or stable references for `Object.is` equality.
 */

type FeatureKey = string

type LiveOverlayVisibilityState = {
  hiddenByFeature: Record<FeatureKey, ReadonlySet<LiveRowKey>>
  actions: {
    hide: (featureKey: FeatureKey, rowKey: LiveRowKey) => void
    show: (featureKey: FeatureKey, rowKey: LiveRowKey) => void
    toggle: (featureKey: FeatureKey, rowKey: LiveRowKey) => void
    hideMany: (featureKey: FeatureKey, rowKeys: readonly LiveRowKey[]) => void
    showMany: (featureKey: FeatureKey, rowKeys: readonly LiveRowKey[]) => void
    resetForFeature: (featureKey: FeatureKey) => void
  }
}

const EMPTY_HIDDEN_SET: ReadonlySet<LiveRowKey> = new Set()

const useLiveOverlayVisibilityStore = create<LiveOverlayVisibilityState>((set) => ({
  hiddenByFeature: {},
  actions: {
    hide: (featureKey, rowKey) =>
      set((state) => {
        const current = state.hiddenByFeature[featureKey]
        if (current?.has(rowKey)) return state
        const next = new Set(current ?? [])
        next.add(rowKey)
        return {
          hiddenByFeature: { ...state.hiddenByFeature, [featureKey]: next },
        }
      }),
    show: (featureKey, rowKey) =>
      set((state) => {
        const current = state.hiddenByFeature[featureKey]
        if (!current?.has(rowKey)) return state
        const next = new Set(current)
        next.delete(rowKey)
        const out = { ...state.hiddenByFeature }
        if (next.size === 0) {
          delete out[featureKey]
        } else {
          out[featureKey] = next
        }
        return { hiddenByFeature: out }
      }),
    toggle: (featureKey, rowKey) =>
      set((state) => {
        const current = state.hiddenByFeature[featureKey]
        const isHidden = current?.has(rowKey) ?? false
        const next = new Set(current ?? [])
        if (isHidden) next.delete(rowKey)
        else next.add(rowKey)
        const out = { ...state.hiddenByFeature }
        if (next.size === 0) delete out[featureKey]
        else out[featureKey] = next
        return { hiddenByFeature: out }
      }),
    hideMany: (featureKey, rowKeys) =>
      set((state) => {
        if (rowKeys.length === 0) return state
        const current = state.hiddenByFeature[featureKey]
        const next = new Set(current ?? [])
        for (const key of rowKeys) next.add(key)
        if (current && next.size === current.size) return state
        return {
          hiddenByFeature: { ...state.hiddenByFeature, [featureKey]: next },
        }
      }),
    showMany: (featureKey, rowKeys) =>
      set((state) => {
        if (rowKeys.length === 0) return state
        const current = state.hiddenByFeature[featureKey]
        if (!current || current.size === 0) return state
        const next = new Set(current)
        for (const key of rowKeys) next.delete(key)
        if (next.size === current.size) return state
        const out = { ...state.hiddenByFeature }
        if (next.size === 0) delete out[featureKey]
        else out[featureKey] = next
        return { hiddenByFeature: out }
      }),
    resetForFeature: (featureKey) =>
      set((state) => {
        if (!(featureKey in state.hiddenByFeature)) return state
        const out = { ...state.hiddenByFeature }
        delete out[featureKey]
        return { hiddenByFeature: out }
      }),
  },
}))

/** Boolean selector — re-renders only when this row's hidden status changes. */
export const useIsLiveRowHidden = (featureKey: FeatureKey, rowKey: LiveRowKey): boolean =>
  useLiveOverlayVisibilityStore((state) => state.hiddenByFeature[featureKey]?.has(rowKey) ?? false)

/** Stable Set reference for the current feature; same identity until contents change. */
export const useHiddenLiveRowKeys = (featureKey: FeatureKey): ReadonlySet<LiveRowKey> =>
  useLiveOverlayVisibilityStore((state) => state.hiddenByFeature[featureKey] ?? EMPTY_HIDDEN_SET)

/** Stable actions object — never causes re-renders. */
export const useLiveOverlayActions = () => useLiveOverlayVisibilityStore((state) => state.actions)
