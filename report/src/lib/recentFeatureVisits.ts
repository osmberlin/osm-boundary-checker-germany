import { z } from 'zod'

/**
 * Detail pages without a match (official only, OSM only) opened in this browser recently.
 * The compare dialog offers them as the other side of a comparison, also across tabs.
 *
 * Stored in `localStorage` (shared by all tabs, unlike `sessionStorage`); entries older than
 * `RECENT_VISIT_MAX_AGE_MS` are dropped on every read and write. Nothing leaves the browser.
 */

export const RECENT_VISIT_MAX_AGE_MS = 3 * 60 * 60 * 1000
const MAX_VISITS_PER_AREA = 50
const STORAGE_KEY = 'grenzabgleich:recent-feature-visits:v1'
/** Fired in this tab after a write; other tabs get the `storage` event. */
const CHANGE_EVENT = 'recent-feature-visits-change'

const recentFeatureVisitSchema = z.object({
  areaId: z.string().min(1),
  featureKey: z.string().min(1),
  category: z.enum(['official_only', 'unmatched_osm']),
  name: z.string(),
  visitedAt: z.number(),
})

export type RecentFeatureVisit = z.infer<typeof recentFeatureVisitSchema>

/** Drops expired entries, keeps the newest visit per row and at most 50 rows per dataset. */
export function pruneRecentVisits(
  visits: readonly RecentFeatureVisit[],
  now: number,
): RecentFeatureVisit[] {
  const newestFirst = [...visits]
    .filter((visit) => now - visit.visitedAt <= RECENT_VISIT_MAX_AGE_MS)
    .sort((a, b) => b.visitedAt - a.visitedAt)
  const seen = new Set<string>()
  const perArea = new Map<string, number>()
  const out: RecentFeatureVisit[] = []
  for (const visit of newestFirst) {
    const id = `${visit.areaId}/${visit.featureKey}`
    if (seen.has(id)) continue
    const count = perArea.get(visit.areaId) ?? 0
    if (count >= MAX_VISITS_PER_AREA) continue
    seen.add(id)
    perArea.set(visit.areaId, count + 1)
    out.push(visit)
  }
  return out
}

function readRaw(): RecentFeatureVisit[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = z.array(recentFeatureVisitSchema).safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : []
  } catch {
    return []
  }
}

function write(visits: readonly RecentFeatureVisit[]): void {
  try {
    if (visits.length === 0) window.localStorage.removeItem(STORAGE_KEY)
    else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(visits))
  } catch {
    // Storage blocked or full: the dialog then only offers the pipeline candidates.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function recordRecentFeatureVisit(visit: Omit<RecentFeatureVisit, 'visitedAt'>): void {
  const now = Date.now()
  write(pruneRecentVisits([...readRaw(), { ...visit, visitedAt: now }], now))
}

export function readRecentFeatureVisits(): RecentFeatureVisit[] {
  return pruneRecentVisits(readRaw(), Date.now())
}

/** Serialized store value for `useSyncExternalStore` (a string compares by value). */
export function recentFeatureVisitsSnapshot(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

export function subscribeRecentFeatureVisits(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === STORAGE_KEY) onChange()
  }
  window.addEventListener('storage', onStorage)
  window.addEventListener(CHANGE_EVENT, onChange)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(CHANGE_EVENT, onChange)
  }
}
