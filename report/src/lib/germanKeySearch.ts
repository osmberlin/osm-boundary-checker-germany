export type GermanKeySearch = {
  key?: string
}

function coerceSearchString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'string') return value === '' ? undefined : value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return undefined
}

/** TanStack Router `validateSearch`: tolerant parsing for the `key` param only. */
export function validateGermanKeySearch(raw: Record<string, unknown>): GermanKeySearch {
  const key = coerceSearchString(raw.key)
  const out: GermanKeySearch = {}
  if (key !== undefined) out.key = key
  return out
}
