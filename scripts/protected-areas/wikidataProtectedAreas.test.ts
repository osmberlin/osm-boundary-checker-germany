import { describe, expect, test } from 'bun:test'
import {
  wikidataProtectedAreasSparql,
  wikidataProtectedAreasSparqlForQids,
} from '../shared/wikidataProtectedAreasQuery.ts'
import {
  mergeBindings,
  missingQids,
  protectedAreasQueryHash,
  shouldReuseDump,
} from './wikidataProtectedAreas.ts'

const v = (value: string) => ({ value })

describe('mergeBindings', () => {
  test('folds the rows of one item and converts the area to hectares', () => {
    const byQid = mergeBindings([
      { qid: v('Q1'), label: v('Naturpark Eins'), wdpa: v('10'), area: v('817060000') },
      {
        qid: v('Q1'),
        label: v('Naturpark Eins'),
        wdpa: v('10'),
        area: v('817060000'),
        osm: v('relation/3892267'),
      },
      {
        qid: v('Q1'),
        wdpa: v('11'),
        website: v('https://example.org/'),
        operatorQid: v('Q5'),
        operatorLabel: v('Verein'),
        commons: v('Naturpark Eins'),
      },
    ])
    expect(byQid).toEqual({
      Q1: {
        label: 'Naturpark Eins',
        wdpa: ['10', '11'],
        osmRelation: ['3892267'],
        website: ['https://example.org/'],
        operator: [{ qid: 'Q5', label: 'Verein' }],
        areaHa: 81706,
        commons: 'Naturpark Eins',
      },
    })
  })

  test('drops the id the label service returns for an unlabeled item; keeps the largest area', () => {
    const byQid = mergeBindings([
      { qid: v('Q2'), label: v('Q2'), area: v('100000') },
      {
        qid: v('Q2'),
        label: v('Q2'),
        area: v('500000'),
        operatorQid: v('Q9'),
        operatorLabel: v('Q9'),
      },
      { qid: v('bad'), label: v('x') },
    ])
    expect(byQid).toEqual({ Q2: { areaHa: 50, operator: [{ qid: 'Q9' }] } })
  })
})

describe('missingQids', () => {
  test('lists referenced ids the dump lacks, sorted and without invalid values', () => {
    expect(missingQids(['Q20', 'Q3', 'Q1', 'x', 'Q3'], { Q1: {} })).toEqual(['Q3', 'Q20'])
  })
})

describe('shouldReuseDump', () => {
  const hash = protectedAreasQueryHash()
  const dump = (fetchedAt: string, queryHash = hash, skipReason?: string) => ({
    fetchedAt,
    queryHash,
    durationMs: 1,
    itemCount: 0,
    referencedCount: 0,
    byQid: {},
    ...(skipReason ? { skipReason } : {}),
  })
  const now = Date.parse('2026-10-26T00:00:00Z')

  test('reuses a dump younger than 7 days with the same query', () => {
    expect(shouldReuseDump(dump('2026-10-24T00:00:00Z'), hash, now)).toBe(true)
  })
  test('refetches when old, when the query changed, on force or after a fallback', () => {
    expect(shouldReuseDump(dump('2026-10-01T00:00:00Z'), hash, now)).toBe(false)
    expect(shouldReuseDump(dump('2026-10-24T00:00:00Z', 'other'), hash, now)).toBe(false)
    expect(shouldReuseDump(dump('2026-10-24T00:00:00Z'), hash, now, true)).toBe(false)
    expect(
      shouldReuseDump(dump('2026-10-24T00:00:00Z', hash, 'wikidata_last_good_fallback'), hash, now),
    ).toBe(false)
  })
})

describe('queries', () => {
  test('main query selects German P809 items; the split adds a prefix filter', () => {
    expect(wikidataProtectedAreasSparql()).toContain('?item wdt:P809 ?wdpa')
    expect(wikidataProtectedAreasSparql()).toContain('?item wdt:P17 wd:Q183')
    expect(wikidataProtectedAreasSparql('3')).toContain('FILTER(STRSTARTS(STR(?wdpa), "3"))')
  })
  test('the id query lists VALUES and keeps P809 optional', () => {
    const query = wikidataProtectedAreasSparqlForQids(['Q1', 'Q2'])
    expect(query).toContain('VALUES ?item { wd:Q1 wd:Q2 }')
    expect(query).toContain('OPTIONAL { ?item wdt:P809 ?wdpa }')
  })
})
