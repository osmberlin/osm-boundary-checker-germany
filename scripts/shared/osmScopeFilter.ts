import { z } from 'zod'

/** Legacy config / embedded JSON value; normalized at parse time. */
export const LEGACY_OSM_SCOPE_FILTER_CENTROID = 'centroid_in_official_coverage' as const

export function normalizeLegacyOsmScopeFilter(v: unknown): unknown {
  return v === LEGACY_OSM_SCOPE_FILTER_CENTROID ? 'intersects_official_coverage' : v
}

/** Primary enum for `compare.osmScopeFilter`. */
export const osmScopeFilterSchema = z.preprocess(
  normalizeLegacyOsmScopeFilter,
  z.enum(['none', 'intersects_official_coverage']),
)
