import type { MatchRule } from '../../../scripts/shared/matchRules.ts'
import type { ComparisonForReport, ReportRow } from '../types/report'

/**
 * The ordered match rules of a dataset as the report shows them: the embedded `matchRules`, or, for
 * tables written before the rules existed, the one rule `officialMatchProperty` and the OSM match
 * tag (or `osmMatchCriteria`) described.
 */
export function reportMatchRules(
  data: Pick<ComparisonForReport, 'matchRules' | 'osmMatchCriteria' | 'filterConfigSummary'>,
  osmMatchTags: readonly string[],
): MatchRule[] {
  if (data.matchRules && data.matchRules.length > 0) return data.matchRules
  if (data.osmMatchCriteria?.kind === 'relation_id') {
    return [{ kind: 'relation_id', relationIds: [...data.osmMatchCriteria.relationIds] }]
  }
  const officialProperty = data.filterConfigSummary?.officialMatchProperty?.trim()
  const osmTag = osmMatchTags[0]?.trim()
  return officialProperty && osmTag ? [{ kind: 'key', officialProperty, osmTag }] : []
}

/** `relation/123` / `way/45` inside a reference value (also an osm.org URL); the raw text otherwise. */
export function osmObjectRefFromReference(raw: unknown): string {
  const text = String(raw ?? '').trim()
  const match = /(way|relation)\/(\d+)/i.exec(text)
  return match ? `${match[1]!.toLowerCase()}/${match[2]}` : text
}

/** The rule that paired a matched row, with its 0-based position; null when it is not recorded. */
export function matchedRuleOfRow(
  row: ReportRow,
  rules: readonly MatchRule[],
): { rule: MatchRule; position: number } | null {
  if (row.category !== 'matched') return null
  const position = row.matchedBy?.rule
  if (position === undefined) return null
  const rule = rules[position]
  return rule ? { rule, position } : null
}
