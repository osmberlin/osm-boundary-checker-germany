import { describe, expect, test } from 'vitest'
import type { MatchRule } from '../../../scripts/shared/matchRules.ts'
import type { ReportRow } from '../types/report'
import { matchedRuleOfRow, osmObjectRefFromReference, reportMatchRules } from './reportMatchRules'

const filterConfigSummary = {
  officialMatchProperty: 'ARS',
  bboxFilter: 'none' as const,
  osmScopeFilter: 'none' as const,
  minZoom: 0,
}

describe('reportMatchRules', () => {
  test('uses the embedded rules', () => {
    const matchRules: MatchRule[] = [
      { kind: 'key', officialProperty: 'match_key', osmTag: 'ref:WDPA' },
      { kind: 'osm_reference', officialProperty: 'dtp_osm_ref' },
    ]
    expect(reportMatchRules({ matchRules, filterConfigSummary }, ['x'])).toEqual(matchRules)
  })

  test('derives the one rule for tables written before the rules existed', () => {
    expect(reportMatchRules({ filterConfigSummary }, ['de:regionalschluessel'])).toEqual([
      { kind: 'key', officialProperty: 'ARS', osmTag: 'de:regionalschluessel' },
    ])
    expect(
      reportMatchRules(
        { filterConfigSummary, osmMatchCriteria: { kind: 'relation_id', relationIds: ['51477'] } },
        ['de:regionalschluessel'],
      ),
    ).toEqual([{ kind: 'relation_id', relationIds: ['51477'] }])
    expect(reportMatchRules({ filterConfigSummary }, [])).toEqual([])
  })
})

describe('matchedRuleOfRow', () => {
  const rules: MatchRule[] = [
    { kind: 'key', officialProperty: 'match_key', osmTag: 'ref:WDPA' },
    { kind: 'osm_reference', officialProperty: 'dtp_osm_ref' },
  ]
  const row = (patch: Partial<ReportRow>) => ({ category: 'matched', ...patch }) as ReportRow

  test('returns the rule and its position for matched rows', () => {
    expect(matchedRuleOfRow(row({ matchedBy: { rule: 1, kind: 'osm_reference' } }), rules)).toEqual(
      {
        rule: rules[1]!,
        position: 1,
      },
    )
  })

  test('is null for unmatched rows, rows without the record and unknown positions', () => {
    expect(matchedRuleOfRow(row({ category: 'official_only' }), rules)).toBeNull()
    expect(matchedRuleOfRow(row({}), rules)).toBeNull()
    expect(matchedRuleOfRow(row({ matchedBy: { rule: 5, kind: 'key' } }), rules)).toBeNull()
  })
})

describe('osmObjectRefFromReference', () => {
  test('extracts type/id, keeps other text', () => {
    expect(osmObjectRefFromReference('https://www.openstreetmap.org/Relation/3892267')).toBe(
      'relation/3892267',
    )
    expect(osmObjectRefFromReference(' way/45 ')).toBe('way/45')
    expect(osmObjectRefFromReference(null)).toBe('')
  })
})
