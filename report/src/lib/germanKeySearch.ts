import { idNormalizationPresetSchema } from '../../../scripts/shared/comparisonPayload.ts'
import type { IdNormalizationPreset } from '../../../scripts/shared/comparisonPayload.ts'

export type GermanKeySearch = {
  key?: string
  preset?: IdNormalizationPreset
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
  const presetParsed = idNormalizationPresetSchema.optional().safeParse(raw.preset)
  const preset = presetParsed.success ? presetParsed.data : undefined
  const out: GermanKeySearch = {}
  if (key !== undefined) out.key = key
  if (area !== undefined) out.area = area
  if (preset !== undefined) out.preset = preset
  return out
}
