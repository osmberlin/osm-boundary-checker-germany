import germanKeyLookupBundle from '../data/germanKeyLookup.gen'
import {
  coerceSchluesselExplorerPreset,
  type GermanSchluesselExplorerPreset,
} from './germanKeyExplorer.ts'

export type GermanKeySearch = {
  key?: string
  preset?: GermanSchluesselExplorerPreset
  area?: string
  /** Destatis GV100AD dataset slug; omitted means `defaultDatasetId` from germanKeyLookup.gen. */
  gvDataset?: string
}

const VALID_GV_DATASET_IDS = new Set<string>(germanKeyLookupBundle.datasetIds)

function coerceSearchString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'string') return value === '' ? undefined : value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return undefined
}

function coerceGvDataset(raw: Record<string, unknown>): string | undefined {
  const slug = coerceSearchString(raw.gvDataset)
  if (slug === undefined) return undefined
  if (!VALID_GV_DATASET_IDS.has(slug)) return undefined
  if (slug === germanKeyLookupBundle.defaultDatasetId) return undefined
  return slug
}

/** TanStack Router `validateSearch`: tolerant parsing + Zod preset validation. */
export function validateGermanKeySearch(raw: Record<string, unknown>): GermanKeySearch {
  const key = coerceSearchString(raw.key)
  const area = coerceSearchString(raw.area)
  const presetRaw = coerceSearchString(raw.preset)
  const presetCoerced = presetRaw !== undefined ? coerceSchluesselExplorerPreset(presetRaw) : ''
  const gvDataset = coerceGvDataset(raw)
  const out: GermanKeySearch = {}
  if (key !== undefined) out.key = key
  if (area !== undefined) out.area = area
  if (presetCoerced !== '') out.preset = presetCoerced
  if (gvDataset !== undefined) out.gvDataset = gvDataset
  return out
}
