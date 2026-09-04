import { z } from 'zod'

/** Primary enum for `compare.osmScopeFilter`. */
export const osmScopeFilterSchema = z.enum(['none', 'intersects_official_coverage'])
