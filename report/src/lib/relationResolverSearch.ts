import { z } from 'zod'

export type RelationResolverSearch = {
  dataset?: string
}

const relationResolverSearchSchema = z
  .object({
    dataset: z.union([z.string(), z.number()]).optional(),
  })
  .passthrough()

/** TanStack Router `validateSearch`: tolerant parsing for optional `dataset`. */
export function validateRelationResolverSearch(
  raw: Record<string, unknown>,
): RelationResolverSearch {
  const parsed = relationResolverSearchSchema.safeParse(raw)
  if (!parsed.success) return {}
  const value = parsed.data.dataset
  if (value == null) return {}
  const dataset = String(value).trim()
  if (dataset === '') return {}
  return { dataset }
}
