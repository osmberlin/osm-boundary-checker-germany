import { useEffect, useSyncExternalStore } from 'react'
import { rowDisplayName } from '../lib/compareRows'
import {
  readRecentFeatureVisits,
  recentFeatureVisitsSnapshot,
  recordRecentFeatureVisit,
  subscribeRecentFeatureVisits,
  type RecentFeatureVisit,
} from '../lib/recentFeatureVisits'
import type { ReportRow } from '../types/report'

/** Recent unmatched detail pages of all tabs; re-renders when another tab opens one. */
export function useRecentFeatureVisits(): RecentFeatureVisit[] {
  // The snapshot only signals changes; the list is parsed (and pruned by age) on each render.
  useSyncExternalStore(subscribeRecentFeatureVisits, recentFeatureVisitsSnapshot, () => '')
  return readRecentFeatureVisits()
}

/** Remembers an official-only or OSM-only detail page for the compare dialog. */
export function useRecordRecentFeatureVisit(areaId: string, row: ReportRow): void {
  const { canonicalMatchKey, category } = row
  const name = rowDisplayName(row)
  useEffect(() => {
    if (category !== 'official_only' && category !== 'unmatched_osm') return
    recordRecentFeatureVisit({ areaId, featureKey: canonicalMatchKey, category, name })
  }, [areaId, canonicalMatchKey, category, name])
}
