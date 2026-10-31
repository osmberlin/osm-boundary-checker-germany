import { createStore, del, entries, get, set, type UseStore } from 'idb-keyval'

/** Live OSM answers stay for a day: a reload shows them again without a request. */
const LIVE_OSM_MAX_AGE_MS = 24 * 60 * 60 * 1000

const LAST_PRUNE_STORAGE_KEY = 'grenzabgleich:live-osm-last-prune:v1'

export type LiveOsmCacheEntry<TValue> = { value: TValue; loadedAt: number }

let store: UseStore | undefined

/** Opened on first use: the store does not exist while tests or prerendering import this. */
function cacheStore() {
  store ??= createStore('osm-boundary-checker-live-osm', 'answers')
  return store
}

function isFresh(entry: LiveOsmCacheEntry<unknown>, now: number) {
  return now - entry.loadedAt < LIVE_OSM_MAX_AGE_MS
}

/** The stored answer of the last 24 hours. Reads the browser's store only: no request goes out. */
export async function readLiveOsmCache<TValue>(key: string) {
  try {
    const entry = await get<LiveOsmCacheEntry<TValue>>(key, cacheStore())
    if (!entry) return null
    if (isFresh(entry, Date.now())) return entry
    void del(key, cacheStore()).catch(() => undefined)
    return null
  } catch {
    return null
  }
}

/** Without the store the answer is only gone after a reload. */
export function writeLiveOsmCache<TValue>(key: string, value: TValue) {
  const entry: LiveOsmCacheEntry<TValue> = { value, loadedAt: Date.now() }
  try {
    set(key, entry, cacheStore()).catch(() => undefined)
  } catch {
    // Blocked storage, as in a private window.
  }
  return entry
}

/**
 * Drops answers of other pages that nobody opened again within the 24 hours. Reading them costs
 * time with several stored searches, so this runs once a day and not on every page load.
 */
export async function pruneLiveOsmCache() {
  try {
    const now = Date.now()
    const lastPrune = Number(window.localStorage.getItem(LAST_PRUNE_STORAGE_KEY))
    if (now - lastPrune < LIVE_OSM_MAX_AGE_MS) return
    window.localStorage.setItem(LAST_PRUNE_STORAGE_KEY, String(now))
    for (const [key, entry] of await entries<string, LiveOsmCacheEntry<unknown>>(cacheStore())) {
      if (!isFresh(entry, now)) void del(key, cacheStore()).catch(() => undefined)
    }
  } catch {
    // Blocked storage, as in a private window.
  }
}
