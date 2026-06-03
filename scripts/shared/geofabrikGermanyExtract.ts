import { GERMANY_OSM_PBF_BASENAME, GERMANY_OSM_PBF_URL } from './germanyOsmPbf.ts'

/** Geofabrik daily replication pointer for the Germany extract (public). */
export const GEOFABRIK_GERMANY_UPDATES_STATE_URL =
  'https://download.geofabrik.de/europe/germany-updates/state.txt'

export const GEOFABRIK_GERMANY_EXTRACT_BASE_URL = 'https://download.geofabrik.de/europe/'

export type GeofabrikGermanyResolveVia = 'explicit' | 'dated_from_state' | 'latest_fallback'

export type GeofabrikGermanyResolvedUrl = {
  url: string
  basename: string
  replicationTimestamp: string
  resolvedVia: GeofabrikGermanyResolveVia
}

/** Parse `timestamp=…` from `germany-updates/state.txt` (colons may be escaped as `\\:`). */
export function parseGermanyUpdatesState(text: string): string | null {
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    const match = /^timestamp=(.+)$/.exec(trimmed)
    if (!match) continue
    return match[1].replaceAll('\\:', ':')
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

/**
 * Resolve the public Germany PBF download URL.
 *
 * Geofabrik's public `germany-latest.osm.pbf` symlink can lag behind the daily
 * dated files; replication `state.txt` points at the current extract.
 */
export type GeofabrikGermanyFetchFn = (input: string, init?: RequestInit) => Promise<Response>

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
        return {
          url: germanyPbfUrlFromBasename(basename),
          basename,
          replicationTimestamp,
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
    resolvedVia: 'latest_fallback',
  }
}
