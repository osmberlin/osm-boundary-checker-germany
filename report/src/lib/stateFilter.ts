import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from 'geojson'
import {
  GERMAN_STATES,
  germanStateCodeSchema,
  type GermanStateCode,
} from '../../../scripts/shared/germanStates.ts'

/** URL key of the state filter: `?state=BB`. */
export const STATE_SEARCH_KEY = 'state'

/** Root `validateSearch`: keeps a valid `state` code, drops anything else under that key. */
export function validateStateSearch(search: Record<string, unknown>): { state?: GermanStateCode } {
  const parsed = germanStateCodeSchema.safeParse(search[STATE_SEARCH_KEY])
  return parsed.success ? { state: parsed.data } : {}
}

export function rowIsInState(row: { states?: readonly GermanStateCode[] }, state: GermanStateCode) {
  return row.states?.includes(state) ?? false
}

/** Rows per state over all rows that carry `states`; states without rows are left out. */
export function countRowsByState(rows: readonly { states?: readonly GermanStateCode[] }[]) {
  const counts = new Map<GermanStateCode, number>()
  for (const row of rows) {
    for (const code of row.states ?? []) counts.set(code, (counts.get(code) ?? 0) + 1)
  }
  return counts
}

/** Dropdown entries in ARS order, with the row count (0 for states without rows). */
export function stateFilterOptions(counts: ReadonlyMap<GermanStateCode, number>) {
  return GERMAN_STATES.map((state) => ({
    code: state.code,
    name: state.name,
    count: counts.get(state.code) ?? 0,
  }))
}

const WORLD_RING: Position[] = [
  [-180, -85],
  [180, -85],
  [180, 85],
  [-180, 85],
  [-180, -85],
]

/**
 * Everything outside the state, as polygons for a dimming fill: the world with each outer ring
 * of the state as a hole, plus the state's own holes (Berlin inside Brandenburg) filled again.
 */
export function stateMaskFeatureCollection(
  outline: Feature<Polygon | MultiPolygon>,
): FeatureCollection<Polygon> {
  const polygons =
    outline.geometry.type === 'Polygon'
      ? [outline.geometry.coordinates]
      : outline.geometry.coordinates
  const outerRings = polygons.flatMap((rings) => (rings[0] ? [rings[0]] : []))
  const innerRings = polygons.flatMap((rings) => rings.slice(1))
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: { type: 'Polygon', coordinates: [WORLD_RING, ...outerRings] },
      },
      ...innerRings.map((ring) => ({
        type: 'Feature' as const,
        properties: {},
        geometry: { type: 'Polygon' as const, coordinates: [ring] },
      })),
    ],
  }
}

/** WGS84 bbox [west, south, east, north] of a state outline, for the map camera. */
export function outlineBbox(
  outline: Feature<Polygon | MultiPolygon>,
): [number, number, number, number] | null {
  const polygons =
    outline.geometry.type === 'Polygon'
      ? [outline.geometry.coordinates]
      : outline.geometry.coordinates
  let w = Infinity
  let s = Infinity
  let e = -Infinity
  let n = -Infinity
  for (const rings of polygons) {
    for (const [x, y] of rings[0] ?? []) {
      if (x === undefined || y === undefined) continue
      w = Math.min(w, x)
      s = Math.min(s, y)
      e = Math.max(e, x)
      n = Math.max(n, y)
    }
  }
  return w < e && s < n ? [w, s, e, n] : null
}
