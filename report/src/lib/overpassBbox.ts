import {
  ALLOWED_OVERPASS_INTERPRETER_URLS,
  DEFAULT_OVERPASS_INTERPRETER_URL,
} from './overpassServers'

const MAX_QUERY_LEN = 48_000

/**
 * Overpass QL: administrative boundaries intersecting bbox (no extra tag filters).
 * Bbox: WGS84 [west, south, east, north] in degrees.
 */
export function buildOverpassBoundaryQuery(bbox: [number, number, number, number]): string {
  const [west, south, east, north] = bbox
  const s = south
  const w = west
  const n = north
  const e = east
  return `[out:json][timeout:90];
(
  relation["boundary"="administrative"](${s},${w},${n},${e});
  way["boundary"="administrative"](${s},${w},${n},${e});
);
out tags;`
}

type OverpassElement = {
  type: string
  id: number
  tags?: Record<string, string>
}

type OverpassDoc = {
  elements?: OverpassElement[]
}

export type OverpassBoundaryHit = {
  type: 'relation' | 'way' | string
  id: number
  tags: Record<string, string>
}

export function parseOverpassBoundaryElements(jsonText: string): OverpassBoundaryHit[] {
  const data = JSON.parse(jsonText) as OverpassDoc
  if (!data || !Array.isArray(data.elements)) {
    throw new Error('INVALID_OVERPASS_JSON')
  }
  const out: OverpassBoundaryHit[] = []
  for (const el of data.elements) {
    if (el.type !== 'relation' && el.type !== 'way') continue
    const tags = el.tags && typeof el.tags === 'object' ? el.tags : {}
    out.push({ type: el.type, id: el.id, tags })
  }
  return out
}

export async function fetchOverpassQuery(
  query: string,
  interpreterUrl: string = DEFAULT_OVERPASS_INTERPRETER_URL,
): Promise<Response> {
  if (!ALLOWED_OVERPASS_INTERPRETER_URLS.has(interpreterUrl)) {
    throw new Error('Interpreter not allowlisted')
  }
  if (query.length > MAX_QUERY_LEN) {
    throw new Error('Query too long')
  }
  const form = new URLSearchParams()
  form.set('data', query)
  return fetch(interpreterUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    },
    body: form.toString(),
  })
}

export async function fetchOverpassBoundaryInBbox(
  bbox: [number, number, number, number],
): Promise<Response> {
  return fetchOverpassQuery(buildOverpassBoundaryQuery(bbox))
}
