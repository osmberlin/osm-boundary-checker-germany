import { z } from 'zod'
import {
  matchesCategoryScope,
  natura2000CodeToRefDe,
  normalizeNatura2000Code,
  presentTypeTags,
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
/**
 * - `equal` / `different`: both sides have a value.
 * - `missing_osm`: the official record has a value, OSM none of the keys.
 * - `missing_reference`: OSM has a value, the official record not.
 * - `missing`: neither has one (nothing to show).
 */
export type AttributeCheckStatus =
  | 'equal'
  | 'different'
  | 'missing_osm'
  | 'missing_reference'
  | 'missing'

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
   * Empty when OSM has none of the keys (`missing_osm`, `missing`).
   */
  osm: Array<{ key: string; value: string }>
  /** Official value as text; empty when the official record has none. */
  officialValue: string
  /**
   * Tags that would fix the OSM side: set on `missing_osm`, and on a `protectedCategory` check that
   * is `different`. Never applied automatically.
   */
  suggestedTags?: Record<string, string>
  /** `protectedCategory` only: the tags the category expects as `key=value`. */
  expectedTags?: string[]
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

/** Tags to set on OSM so that a check can be `equal`, from the official value. */
function suggestedTagsFor(
  check: AttributeCheckConfig,
  compare: AttributeCheckCompareMode,
  officialValue: string,
): Record<string, string> {
  const key = check.osm[0]!
  switch (compare) {
    case 'natura2000': {
      const code = normalizeNatura2000Code(officialValue)
      return /^\d{7}$/.test(code) ? { [key]: natura2000CodeToRefDe(`DE${code}`) } : {}
    }
    case 'protectedCategory':
      return {}
    case 'exact':
    case 'name':
      return { [key]: officialValue }
  }
}

function evaluateProtectedCategory(
  base: Pick<AttributeCheckResult, 'label' | 'official' | 'compare' | 'osmKeys'>,
  officialValue: string,
  pairs: Array<{ key: string; value: string }>,
  osmTags: TagBag,
): AttributeCheckResult {
  const categoryId = Number(officialValue)
  const rule = Number.isInteger(categoryId) ? protectedAreaCategoryRule(categoryId) : null
  if (rule == null) {
    return officialValue === '' && pairs.length > 0
      ? { ...base, status: 'missing_reference', osm: pairs, officialValue }
      : { ...base, status: 'missing', osm: pairs, officialValue }
  }
  if (matchesCategoryScope(osmTags, categoryId)) {
    return { ...base, status: 'equal', osm: pairs, officialValue }
  }
  const present = new Set(presentTypeTags(osmTags))
  const expectedTags = Object.entries(rule.expectedTags).map(([key, value]) => `${key}=${value}`)
  const suggestedTags = Object.fromEntries(
    Object.entries(rule.expectedTags).filter(([key, value]) => !present.has(`${key}=${value}`)),
  )
  return {
    ...base,
    status: pairs.length === 0 ? 'missing_osm' : 'different',
    osm: pairs,
    officialValue,
    expectedTags,
    suggestedTags,
  }
}

function evaluateOne(
  check: AttributeCheckConfig,
  officialProperties: Record<string, unknown>,
  osmTags: TagBag,
): AttributeCheckResult {
  const compare = check.compare ?? 'exact'
  const base = { label: check.label, official: check.official, compare, osmKeys: check.osm }
  const officialValue = stringValue(officialProperties[check.official])
  const pairs = presentOsmPairs(check.osm, osmTags)
  if (compare === 'protectedCategory') {
    return evaluateProtectedCategory(base, officialValue, pairs, osmTags)
  }
  if (officialValue === '') {
    return pairs.length === 0
      ? { ...base, status: 'missing', osm: pairs, officialValue }
      : { ...base, status: 'missing_reference', osm: pairs, officialValue }
  }
  if (pairs.length === 0) {
    const suggestedTags = suggestedTagsFor(check, compare, officialValue)
    return {
      ...base,
      status: 'missing_osm',
      osm: pairs,
      officialValue,
      ...(Object.keys(suggestedTags).length > 0 ? { suggestedTags } : {}),
    }
  }

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
  }
  return matched
    ? { ...base, status: 'equal', osm: [matched], officialValue }
    : { ...base, status: 'different', osm: pairs, officialValue }
}

/** Keys the pipeline adds to an OSM extract row; they are not OSM tags. */
const SYNTHETIC_OSM_KEYS: ReadonlySet<string> = new Set(['@id', 'osm_id', 'osm_way_id'])

/**
 * Result of every configured check for one official row and the tags of an OSM object.
 * Without an OSM side (no tags, e.g. an official-only row without a chosen candidate) there is
 * nothing to compare with, so there are no results — not even "missing in OSM".
 */
export function evaluateAttributeChecks(
  checks: readonly AttributeCheckConfig[] | undefined,
  officialProperties: Record<string, unknown> | null | undefined,
  osmTags: TagBag | null | undefined,
): AttributeCheckResult[] {
  if (!checks || checks.length === 0) return []
  if (!osmTags || Object.keys(osmTags).every((key) => SYNTHETIC_OSM_KEYS.has(key))) return []
  return checks.map((check) => evaluateOne(check, officialProperties ?? {}, osmTags ?? {}))
}
