/**
 * Per-category rules for DtP protected areas (`category_id`) against OSM tags.
 *
 * One place for two jobs:
 * - `expectedTags`: what we suggest to mappers (attribute hints, candidate suggestions).
 * - `inScope`: loose "this OSM object could be a <category>" predicate, used as type scope
 *   (post-match filter for `unmatchedOsm`, spatial candidates). Key matches are never dropped by it.
 *
 * Values were checked against `germany-protected-areas-candidates.fgb` (17,278 objects, 2026-10-25)
 * and DE:Tag:boundary=protected_area. Tag usage that justified the rules (objects):
 * - NSG: protection_title=Naturschutzgebiet 8,500 (+ class 4: 8,049 with leisure=nature_reserve),
 *   leisure=nature_reserve alone 1,068, protect_class=4 alone 149.
 * - LSG: protection_title=Landschaftsschutzgebiet 480 (typos "Landschaftschutzgebiet"), protect_class=5 ~640
 *   (also Naturpark 82, Geschuetzter Landschaftsbestandteil ~20).
 * - FFH: protect_class=97 288, titles "Fauna-Flora-Habitat" 124, "Fauna-Flora-Habitat-Gebiet" 70,
 *   "Flora-Fauna-Habitat" 30, "FFH-Gebiet" 11.
 * - Vogelschutz: protection_title=Vogelschutzgebiet 38 (16+3 with class 97, 9 without class).
 * - Biosphaerenreservat: protect_class=98 + title 13 (Kernzonen have class 1 and a "-Kernzone" title).
 * - Naturpark: protection_title=Naturpark 84 (class 5). Nationalpark: boundary=national_park 15, class 2.
 * - Nationales Naturmonument: titles "Nationales Naturmonument" 3, "nature_monument" ~30 (Naturdenkmal, class 7).
 * - Natura 2000 site code: `ref:DE` (`7741-371`, 190 objects, 182 with class 97) is the common key;
 *   `ref:SCI` 13 and `ref:natura2000` 10 are rare; `ref:SPA` does not occur.
 */

export type TagBag = Readonly<Record<string, unknown>>

export type ProtectedAreaCategoryRule = {
  id: number
  /** German DtP name, for logs and docs. */
  name: string
  /** Tags suggested for a correctly tagged object (never applied automatically). */
  expectedTags: Readonly<Record<string, string>>
  /** Loose type predicate: could this OSM object be this kind of protected area? */
  inScope: (tags: TagBag) => boolean
  /** Natura 2000 categories: OSM key we suggest for the EU/DE site code. */
  natura2000RefKey?: string
}

/** Trimmed single string value of a tag, or ''. */
function tagValue(tags: TagBag, key: string): string {
  const raw = tags[key]
  if (raw == null) return ''
  return String(raw).trim()
}

/** `;`-separated tag values, trimmed and lower-cased (`protect_class=97;98`). */
function tagValues(tags: TagBag, key: string): string[] {
  return tagValue(tags, key)
    .split(';')
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length > 0)
}

function hasClass(tags: TagBag, protectClass: string): boolean {
  return tagValues(tags, 'protect_class').includes(protectClass)
}

function titleMatches(tags: TagBag, pattern: RegExp): boolean {
  return pattern.test(tagValue(tags, 'protection_title'))
}

const NSG_TITLE = /^naturschutzgebiet$/i
const LSG_TITLE = /^landschafts?chutzgebiet$/i
const BIOSPHERE_TITLE = /^biosph(ä|ae)renreservat$/i
const NATURPARK_TITLE = /naturpark|natur- und geopark/i
const FFH_TITLE = /ffh|fauna-flora-habitat|flora-fauna-habitat/i
const SPA_TITLE = /vogelschutz|special protection area/i
const MONUMENT_TITLE = /naturmonument|nature[_ ]monument|natural_monument/i

export const PROTECTED_AREA_CATEGORY_RULES: readonly ProtectedAreaCategoryRule[] = [
  {
    id: 1,
    name: 'Nationalpark',
    expectedTags: {
      boundary: 'national_park',
      protect_class: '2',
      protection_title: 'Nationalpark',
    },
    inScope: (tags) => tagValue(tags, 'boundary') === 'national_park' || hasClass(tags, '2'),
  },
  {
    id: 2,
    name: 'Naturschutzgebiet',
    expectedTags: {
      boundary: 'protected_area',
      leisure: 'nature_reserve',
      protect_class: '4',
      protection_title: 'Naturschutzgebiet',
    },
    inScope: (tags) =>
      titleMatches(tags, NSG_TITLE) ||
      hasClass(tags, '4') ||
      tagValue(tags, 'leisure') === 'nature_reserve',
  },
  {
    id: 3,
    name: 'Biosphärenreservat',
    expectedTags: {
      boundary: 'protected_area',
      protect_class: '98',
      protection_title: 'Biosphärenreservat',
    },
    inScope: (tags) => hasClass(tags, '98') || titleMatches(tags, BIOSPHERE_TITLE),
  },
  {
    id: 4,
    name: 'Naturpark',
    expectedTags: {
      boundary: 'protected_area',
      protect_class: '5',
      protection_title: 'Naturpark',
    },
    inScope: (tags) => titleMatches(tags, NATURPARK_TITLE),
  },
  {
    id: 5,
    name: 'Landschaftsschutzgebiet',
    expectedTags: {
      boundary: 'protected_area',
      protect_class: '5',
      protection_title: 'Landschaftsschutzgebiet',
    },
    inScope: (tags) => titleMatches(tags, LSG_TITLE) || hasClass(tags, '5'),
  },
  {
    id: 7,
    name: 'Fauna-Flora-Habitat-Gebiet',
    expectedTags: {
      boundary: 'protected_area',
      protect_class: '97',
      protection_title: 'Fauna-Flora-Habitat',
    },
    // FFH and Vogelschutz share protect_class=97: the title decides, class 97 alone fits both.
    inScope: (tags) =>
      titleMatches(tags, FFH_TITLE) || (hasClass(tags, '97') && !titleMatches(tags, SPA_TITLE)),
    natura2000RefKey: 'ref:DE',
  },
  {
    id: 8,
    name: 'Vogelschutzgebiet',
    expectedTags: {
      boundary: 'protected_area',
      protect_class: '97',
      protection_title: 'Vogelschutzgebiet',
    },
    inScope: (tags) =>
      titleMatches(tags, SPA_TITLE) || (hasClass(tags, '97') && !titleMatches(tags, FFH_TITLE)),
    natura2000RefKey: 'ref:DE',
  },
  {
    id: 50,
    name: 'Nationales Naturmonument',
    expectedTags: {
      boundary: 'protected_area',
      protect_class: '3',
      protection_title: 'Nationales Naturmonument',
    },
    inScope: (tags) => titleMatches(tags, MONUMENT_TITLE),
  },
]

const RULE_BY_ID = new Map(PROTECTED_AREA_CATEGORY_RULES.map((rule) => [rule.id, rule]))

export function protectedAreaCategoryRule(
  categoryId: number | null | undefined,
): ProtectedAreaCategoryRule | null {
  if (categoryId == null) return null
  return RULE_BY_ID.get(categoryId) ?? null
}

/** `category_id` of an official DtP row (GeoJSON properties), or null. */
export function categoryIdFromOfficialProperties(
  props: Record<string, unknown> | null | undefined,
): number | null {
  const raw = props?.category_id
  const n = typeof raw === 'number' ? raw : Number(raw)
  return Number.isInteger(n) && n > 0 ? n : null
}

/** OSM object fits the type scope of one category. Unknown categories fit everything. */
export function matchesCategoryScope(tags: TagBag, categoryId: number | null): boolean {
  const rule = protectedAreaCategoryRule(categoryId)
  return rule ? rule.inScope(tags) : true
}

/** OSM object fits the type scope of at least one of the dataset's categories. */
export function matchesAnyCategoryScope(tags: TagBag, categoryIds: readonly number[]): boolean {
  return categoryIds.some((id) => {
    const rule = protectedAreaCategoryRule(id)
    return rule ? rule.inScope(tags) : false
  })
}

/** Tags that matter for the type check, `key=value` of the ones present on the object. */
export function presentTypeTags(tags: TagBag): string[] {
  const out: string[] = []
  for (const key of ['boundary', 'leisure', 'protect_class', 'protection_title']) {
    const value = tagValue(tags, key)
    if (value.length > 0) out.push(`${key}=${value}`)
  }
  return out
}

/** Expected tags of a category as `key=value` strings. */
export function expectedTypeTags(rule: ProtectedAreaCategoryRule): string[] {
  return Object.entries(rule.expectedTags).map(([key, value]) => `${key}=${value}`)
}

/**
 * Natura 2000 site code as comparable string: `DE7148371`, `DE 4050-301`, `7741-371`,
 * `7932-371.02` → `7148371`, `4050301`, `7741371`, `7932371`. Other country prefixes are kept
 * (`AT3438000`), so they never equal a German code. Empty when there is no usable code.
 */
export function normalizeNatura2000Code(raw: unknown): string {
  if (raw == null) return ''
  const compact = String(raw)
    .toUpperCase()
    .replace(/\.\d+$/, '')
    .replace(/[^A-Z0-9]/g, '')
  if (compact.length === 0) return ''
  return compact.startsWith('DE') ? compact.slice(2) : compact
}

/** Natura 2000 codes of an OSM object (`ref:DE`, `ref:SCI`, `ref:natura2000`, `;`-separated allowed). */
export function osmNatura2000Codes(tags: TagBag): string[] {
  const codes: string[] = []
  for (const key of ['ref:DE', 'ref:SCI', 'ref:natura2000']) {
    for (const part of tagValue(tags, key).split(';')) {
      const code = normalizeNatura2000Code(part)
      if (code.length > 0 && !codes.includes(code)) codes.push(code)
    }
  }
  return codes
}

/** `DE7148371` → `7148-371` (OSM `ref:DE` notation); other shapes come back unchanged. */
export function natura2000CodeToRefDe(code: string): string {
  const m = /^DE(\d{4})(\d{3})$/i.exec(code.trim())
  return m ? `${m[1]}-${m[2]}` : code.trim()
}
