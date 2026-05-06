import { z } from 'zod'

/** When true, feature detail map shows all boundaries and enables click-through navigation. */
export const FEATURE_DETAIL_ALL_BOUNDARIES_KEY = 'allBoundaries'

const boolish = z.union([z.boolean(), z.string(), z.number()])

function coerceTruthyBoolish(value: unknown): boolean {
  if (value == null) return false
  const parsed = boolish.safeParse(value)
  if (!parsed.success) return false
  const v = parsed.data
  return v === true || v === 'true' || v === '1' || v === 1
}

const featureDetailSearchSchema = z
  .object({
    map: z.string().optional(),
    mapOfficial: boolish.optional(),
    mapOsm: boolish.optional(),
    mapDiff: boolish.optional(),
    [FEATURE_DETAIL_ALL_BOUNDARIES_KEY]: boolish.optional(),
  })
  .passthrough()

/** TanStack Router `validateSearch` for the feature detail route (Zod 4 + passthrough for unknown keys). */
export function validateFeatureDetailSearch(raw: Record<string, unknown>): Record<string, unknown> {
  const parsed = featureDetailSearchSchema.safeParse(raw)
  if (!parsed.success) return { ...raw }

  const data = parsed.data
  const out: Record<string, unknown> = { ...data }

  if (!coerceTruthyBoolish(data[FEATURE_DETAIL_ALL_BOUNDARIES_KEY])) {
    delete out[FEATURE_DETAIL_ALL_BOUNDARIES_KEY]
  } else {
    out[FEATURE_DETAIL_ALL_BOUNDARIES_KEY] = true
  }

  return out
}
