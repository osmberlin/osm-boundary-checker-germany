import { z } from 'zod'
import {
  matchesCategoryScope,
  normalizeNatura2000Code,
  protectedAreaCategoryRule,
  type TagBag,
} from './protectedAreaCategories.ts'

const trimmedString = z.string().trim().min(1)

export const ATTRIBUTE_CHECK_COMPARE_MODES = [
  'exact',
  'name',
  'natura2000',
  'protectedCategory',
] as const

/**
 * Attribute check from `compare.attributeChecks` in the dataset config: one official property
 * against one or more OSM keys. The report marks the official property on the feature detail page
 * and lists the result in a summary line.
 *
 * - `exact` (default): trimmed string equality; `;`-separated OSM values match per part.
 * - `name`: names normalized (case, umlauts, diacritics, `(…)`/`<…>` text, leading designation words
 *   such as "NSG" or "Naturschutzgebiet"); equal when any listed OSM key matches.
 * - `natura2000`: Natura 2000 site codes (`DE5526471` equals `5526-471`).
 * - `protectedCategory`: official value is the DtP `category_id`; equal when the OSM tags fit the
 *   category's type scope (`protectedAreaCategories.ts`).
 */
export const attributeCheckConfigSchema = z
  .object({
    /** Shown in the summary line, e.g. "Wikidata". */
    label: trimmedString,
    /** Official property that is checked (and gets the marker). */
    official: trimmedString,
    /** OSM keys to read; the first with a value is shown, `name` mode matches any of them. */
    osm: z.array(trimmedString).min(1),
    compare: z.enum(ATTRIBUTE_CHECK_COMPARE_MODES).optional(),
  })
  .strict()

export const attributeChecksConfigSchema = z.array(attributeCheckConfigSchema).min(1)

export type AttributeCheckConfig = z.infer<typeof attributeCheckConfigSchema>
export type AttributeCheckCompareMode = (typeof ATTRIBUTE_CHECK_COMPARE_MODES)[number]
export type AttributeCheckStatus = 'equal' | 'different' | 'missing'

export type AttributeCheckResult = {
  label: string
  /** Official property the check belongs to. */
  official: string
  compare: AttributeCheckCompareMode
  /** The OSM keys the check lists (more than one for the combined name rule). */
  osmKeys: string[]
  status: AttributeCheckStatus
  /**
   * OSM key/value pairs used: the matching one when equal, otherwise every listed key that has a value.
   * Empty when `missing` because OSM has none of the keys.
   */
  osm: Array<{ key: string; value: string }>
}

function stringValue(raw: unknown): string {
  if (raw == null) return ''
  if (typeof raw === 'object') return ''
  return String(raw).trim()
}

const LEADING_DESIGNATIONS: ReadonlySet<string> = new Set([
  'nsg',
  'lsg',
  'naturschutzgebiet',
  'landschaftsschutzgebiet',
  'landschaftschutzgebiet',
  'naturpark',
  'biosphaerenreservat',
  'nationalpark',
])

/**
 * Comparable form of a protected-area name: no `(…)`/`<…>` text, lower case, umlauts folded
 * (ä→ae), diacritics stripped, punctuation collapsed to single spaces and leading designation
 * words ("NSG", "Naturschutzgebiet", …) dropped. A name that is only a designation stays as is.
 */
export function normalizeAreaNameForCompare(raw: unknown): string {
  let s = stringValue(raw)
  if (s === '') return ''
  s = s.replace(/\([^)]*\)/g, ' ').replace(/<[^>]*>/g, ' ')
  s = s
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
  const tokens = s.split(/[^a-z0-9]+/).filter((token) => token.length > 0)
  let start = 0
  while (start < tokens.length - 1 && LEADING_DESIGNATIONS.has(tokens[start]!)) start += 1
  return tokens.slice(start).join(' ')
}

function presentOsmPairs(
  keys: readonly string[],
  osmTags: TagBag,
): Array<{ key: string; value: string }> {
  const out: Array<{ key: string; value: string }> = []
  for (const key of keys) {
    const value = stringValue(osmTags[key])
    if (value !== '') out.push({ key, value })
  }
  return out
}

function splitParts(value: string): string[] {
  return value
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
}

/** First present OSM pair whose value `matches`, if any. */
function firstMatchingPair(
  pairs: ReadonlyArray<{ key: string; value: string }>,
  matches: (value: string) => boolean,
): { key: string; value: string } | null {
  return pairs.find((pair) => matches(pair.value)) ?? null
}

function evaluateOne(
  check: AttributeCheckConfig,
  officialProperties: Record<string, unknown>,
  osmTags: TagBag,
): AttributeCheckResult {
  const compare = check.compare ?? 'exact'
  const base = { label: check.label, official: check.official, compare, osmKeys: check.osm }
  const officialRaw = officialProperties[check.official]
  const officialValue = stringValue(officialRaw)
  const pairs = presentOsmPairs(check.osm, osmTags)
  if (officialValue === '' || pairs.length === 0) return { ...base, status: 'missing', osm: pairs }

  let matched: { key: string; value: string } | null = null
  switch (compare) {
    case 'exact':
      matched = firstMatchingPair(
        pairs,
        (value) => value === officialValue || splitParts(value).includes(officialValue),
      )
      break
    case 'name': {
      const officialName = normalizeAreaNameForCompare(officialValue)
      matched =
        officialName === ''
          ? null
          : firstMatchingPair(pairs, (value) => normalizeAreaNameForCompare(value) === officialName)
      break
    }
    case 'natura2000': {
      const officialCode = normalizeNatura2000Code(officialValue)
      matched =
        officialCode === ''
          ? null
          : firstMatchingPair(pairs, (value) =>
              splitParts(value).some((part) => normalizeNatura2000Code(part) === officialCode),
            )
      break
    }
    case 'protectedCategory': {
      const categoryId = Number(officialValue)
      if (!Number.isInteger(categoryId) || protectedAreaCategoryRule(categoryId) == null) {
        return { ...base, status: 'missing', osm: pairs }
      }
      return matchesCategoryScope(osmTags, categoryId)
        ? { ...base, status: 'equal', osm: pairs }
        : { ...base, status: 'different', osm: pairs }
    }
  }
  return matched
    ? { ...base, status: 'equal', osm: [matched] }
    : { ...base, status: 'different', osm: pairs }
}

/** Result of every configured check for one official row and the tags of an OSM object. */
export function evaluateAttributeChecks(
  checks: readonly AttributeCheckConfig[] | undefined,
  officialProperties: Record<string, unknown> | null | undefined,
  osmTags: TagBag | null | undefined,
): AttributeCheckResult[] {
  if (!checks || checks.length === 0) return []
  return checks.map((check) => evaluateOne(check, officialProperties ?? {}, osmTags ?? {}))
}
