import { z } from 'zod'

export type GermanKeySearch = {
  key?: string
}

const germanKeySearchSchema = z.object({
  key: z.union([z.string(), z.number()]).optional(),
})

/** TanStack Router `validateSearch`: tolerant parsing for the `key` param only. */
export function validateGermanKeySearch(raw: Record<string, unknown>): GermanKeySearch {
  const parsed = germanKeySearchSchema.safeParse(raw)
  if (!parsed.success) return {}
  if (parsed.data.key === undefined) return {}
  const key = String(parsed.data.key)
  if (key === '') return {}
  return { key }
}
