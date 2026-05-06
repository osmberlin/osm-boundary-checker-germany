import {
  coerceSchluesselExplorerPreset,
  type GermanSchluesselExplorerPreset,
} from './germanKeyExplorer.ts'

export type GermanKeySearch = {
  key?: string
  preset?: GermanSchluesselExplorerPreset
  area?: string
}

function coerceSearchString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'string') return value === '' ? undefined : value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return undefined
}

/** TanStack Router `validateSearch`: tolerant parsing + Zod preset validation. */
export function validateGermanKeySearch(raw: Record<string, unknown>): GermanKeySearch {
  const key = coerceSearchString(raw.key)
  const area = coerceSearchString(raw.area)
  const presetRaw = coerceSearchString(raw.preset)
  const presetCoerced = presetRaw !== undefined ? coerceSchluesselExplorerPreset(presetRaw) : ''
  const out: GermanKeySearch = {}
  if (key !== undefined) out.key = key
  if (area !== undefined) out.area = area
  if (presetCoerced !== '') out.preset = presetCoerced
  return out
}
