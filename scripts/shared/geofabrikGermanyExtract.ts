import { GERMANY_OSM_PBF_BASENAME, GERMANY_OSM_PBF_URL } from './germanyOsmPbf.ts'

/** Geofabrik daily replication pointer for the Germany extract (public). */
export const GEOFABRIK_GERMANY_UPDATES_STATE_URL =
  'https://download.geofabrik.de/europe/germany-updates/state.txt'

export const GEOFABRIK_GERMANY_EXTRACT_BASE_URL = 'https://download.geofabrik.de/europe/'

export type GeofabrikGermanyResolveVia =
  | 'explicit'
  | 'dated_from_state'
  | 'latest_newer_than_state'
  | 'latest_fallback'

export type GeofabrikGermanyResolvedUrl = {
  url: string
  basename: string
  replicationTimestamp: string
  /** `Last-Modified` of `germany-latest`; null when not read or not available. */
  latestModifiedAt: string | null
  resolvedVia: GeofabrikGermanyResolveVia
}

/** Parse `timestamp=…` from `germany-updates/state.txt` (colons may be escaped as `\\:`). */
export function parseGermanyUpdatesState(text: string): string | null {
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    const match = /^timestamp=(.+)$/.exec(trimmed)
    const timestamp = match?.[1]
    if (timestamp === undefined) continue
    return timestamp.replaceAll('\\:', ':')
  }
  return null
}

/** Map replication timestamp to Geofabrik dated basename (`germany-YYMMDD.osm.pbf`). */
export function germanyPbfBasenameFromReplicationTimestamp(timestamp: string): string {
  const d = new Date(timestamp)
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid Geofabrik replication timestamp: ${timestamp}`)
  }
  const yy = String(d.getUTCFullYear()).slice(-2)
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `germany-${yy}${mm}${dd}.osm.pbf`
}

export function germanyPbfUrlFromBasename(basename: string): string {
  return `${GEOFABRIK_GERMANY_EXTRACT_BASE_URL}${basename}`
}

export type GeofabrikGermanyFetchFn = (input: string, init?: RequestInit) => Promise<Response>

/** `Last-Modified` of `germany-latest` as ISO string; null when it cannot be read. */
async function fetchGermanyLatestModifiedAt(
  fetchFn: GeofabrikGermanyFetchFn,
): Promise<string | null> {
  try {
    const res = await fetchFn(GERMANY_OSM_PBF_URL, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
    })
    const modifiedAt = new Date(res.headers.get('last-modified') ?? '')
    return res.ok && !Number.isNaN(modifiedAt.getTime()) ? modifiedAt.toISOString() : null
  } catch {
    return null
  }
}

/**
 * Resolve the public Germany PBF download URL.
 *
 * `germany-latest.osm.pbf` redirects to a mirror that can lag behind the daily dated
 * files, and replication `state.txt` can lag behind that mirror. Use the dated file
 * from `state.txt`, unless `germany-latest` was modified after the state's data time.
 * The file for the same day is always modified later, so that case only swaps the
 * download source for identical data.
 */
export async function resolveGeofabrikGermanyPbfUrl(options?: {
  explicitUrl?: string | null
  fetchFn?: GeofabrikGermanyFetchFn
}): Promise<GeofabrikGermanyResolvedUrl> {
  const explicit = options?.explicitUrl?.trim()
  if (explicit) {
    const basename = explicit.split('/').filter(Boolean).pop() ?? GERMANY_OSM_PBF_BASENAME
    return {
      url: explicit,
      basename,
      replicationTimestamp: '',
      latestModifiedAt: null,
      resolvedVia: 'explicit',
    }
  }

  const fetchFn = options?.fetchFn ?? fetch
  try {
    const res = await fetchFn(GEOFABRIK_GERMANY_UPDATES_STATE_URL, { redirect: 'follow' })
    if (res.ok) {
      const text = await res.text()
      const replicationTimestamp = parseGermanyUpdatesState(text)
      if (replicationTimestamp) {
        const basename = germanyPbfBasenameFromReplicationTimestamp(replicationTimestamp)
        const latestModifiedAt = await fetchGermanyLatestModifiedAt(fetchFn)
        if (
          latestModifiedAt &&
          new Date(latestModifiedAt).getTime() > new Date(replicationTimestamp).getTime()
        ) {
          return {
            url: GERMANY_OSM_PBF_URL,
            basename: GERMANY_OSM_PBF_BASENAME,
            replicationTimestamp,
            latestModifiedAt,
            resolvedVia: 'latest_newer_than_state',
          }
        }
        return {
          url: germanyPbfUrlFromBasename(basename),
          basename,
          replicationTimestamp,
          latestModifiedAt,
          resolvedVia: 'dated_from_state',
        }
      }
    }
  } catch {
    // fall through to latest
  }

  return {
    url: GERMANY_OSM_PBF_URL,
    basename: GERMANY_OSM_PBF_BASENAME,
    replicationTimestamp: '',
    latestModifiedAt: null,
    resolvedVia: 'latest_fallback',
  }
}
