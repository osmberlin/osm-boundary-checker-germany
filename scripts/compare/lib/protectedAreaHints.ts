import type { AttributeHint } from '../../shared/comparisonPayload.ts'
import {
  categoryIdFromOfficialProperties,
  expectedTypeTags,
  natura2000CodeToRefDe,
  normalizeNatura2000Code,
  osmNatura2000Codes,
  presentTypeTags,
  protectedAreaCategoryRule,
} from '../../shared/protectedAreaCategories.ts'

function trimmed(raw: unknown): string {
  return raw == null ? '' : String(raw).trim()
}

/** `way/1` / `relation/1` from a DtP `osm` ref or an OSM `@id`; null for anything else. */
function osmObjectRef(raw: unknown): string | null {
  const m = /(way|relation|node)\/(\d+)/i.exec(trimmed(raw))
  return m ? `${m[1]!.toLowerCase()}/${m[2]}` : null
}

function osmObjectRefFromProps(props: Record<string, unknown>): string | null {
  const fromId = osmObjectRef(props['@id'])
  if (fromId) return fromId
  const way = trimmed(props.osm_way_id)
  if (/^\d+$/.test(way) && way !== '0') return `way/${way}`
  const relation = trimmed(props.osm_id).replace(/^-/, '')
  if (/^\d+$/.test(relation) && relation !== '0') return `relation/${relation}`
  return null
}

/**
 * Tag suggestions for a matched protected-area row (DtP record vs. the matched OSM object).
 * Suggestions, not failures: nothing here changes the match or its metrics.
 */
export function computeProtectedAreaAttributeHints(input: {
  officialProperties: Record<string, unknown> | null
  osmProperties: Record<string, unknown> | null
}): AttributeHint[] {
  const official = input.officialProperties
  const osm = input.osmProperties
  if (!official || !osm) return []
  const hints: AttributeHint[] = []

  const categoryId = categoryIdFromOfficialProperties(official)
  const rule = protectedAreaCategoryRule(categoryId)
  if (rule && !rule.inScope(osm)) {
    const expected = expectedTypeTags(rule)
    const actualKeys = new Set(presentTypeTags(osm))
    const suggestedTags: Record<string, string> = {}
    for (const entry of expected) {
      if (actualKeys.has(entry)) continue
      const [key, value] = entry.split('=')
      if (key && value) suggestedTags[key] = value
    }
    hints.push({
      id: 'type_tags',
      expected,
      actual: presentTypeTags(osm),
      suggestedTags,
    })
  }

  const officialWikidata = trimmed(official.wikidata).toUpperCase()
  if (officialWikidata.length > 0) {
    const osmWikidata = trimmed(osm.wikidata)
    const osmValues = osmWikidata
      .split(';')
      .map((q) => q.trim().toUpperCase())
      .filter((q) => q.length > 0)
    if (osmValues.length === 0) {
      hints.push({
        id: 'wikidata_missing',
        expected: [`wikidata=${officialWikidata}`],
        actual: [],
        suggestedTags: { wikidata: officialWikidata },
      })
    } else if (!osmValues.includes(officialWikidata)) {
      hints.push({
        id: 'wikidata_differs',
        expected: [`wikidata=${officialWikidata}`],
        actual: [`wikidata=${osmWikidata}`],
      })
    }
  }

  const dtpRef = osmObjectRef(official.dtp_osm_ref)
  const osmRef = osmObjectRefFromProps(osm)
  if (dtpRef && osmRef && dtpRef !== osmRef) {
    hints.push({ id: 'osm_ref_differs', expected: [dtpRef], actual: [osmRef] })
  }

  const n2kCode = normalizeNatura2000Code(official.natura2000_code)
  if (rule?.natura2000RefKey && n2kCode.length > 0 && !osmNatura2000Codes(osm).includes(n2kCode)) {
    const rawCode = trimmed(official.natura2000_code).toUpperCase()
    const refDe = natura2000CodeToRefDe(rawCode.startsWith('DE') ? rawCode : `DE${n2kCode}`)
    const actual = ['ref:DE', 'ref:SCI', 'ref:natura2000']
      .map((key) => [key, trimmed(osm[key])] as const)
      .filter(([, value]) => value.length > 0)
      .map(([key, value]) => `${key}=${value}`)
    hints.push({
      id: 'natura2000_missing',
      expected: [`${rule.natura2000RefKey}=${refDe}`],
      actual,
      suggestedTags: { [rule.natura2000RefKey]: refDe },
    })
  }

  return hints
}
