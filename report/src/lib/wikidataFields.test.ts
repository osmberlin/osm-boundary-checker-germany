import { describe, expect, test } from 'vitest'
import { normalizeWebsite, wikidataFieldRows } from './wikidataFields'

const byId = (rows: ReturnType<typeof wikidataFieldRows>) =>
  Object.fromEntries(rows.map((row) => [row.id, row]))

describe('wikidataFieldRows', () => {
  const context = {
    official: { name: 'Haßberge', wdpa: '', dtp_organizations: 'Naturpark Haßberge e. V.' },
    osm: {
      name: 'Naturpark Haßberge',
      'ref:WDPA': '6991',
      website: 'http://www.naturpark-hassberge.de',
    },
    osmRelationId: '3892267',
  }

  test('compares and suggests: missing WDPA id and relation id are offered, website and name agree', () => {
    const rows = byId(
      wikidataFieldRows(
        {
          qid: 'Q883905',
          label: 'Naturpark Haßberge',
          website: ['https://www.naturpark-hassberge.de/'],
        },
        context,
      ),
    )
    expect(rows.label?.status).toBe('equal')
    expect(rows.website?.status).toBe('equal')
    expect(rows.wdpa).toMatchObject({ status: 'none', suggestion: '6991' })
    expect(rows.osmRelation).toMatchObject({ status: 'none', suggestion: '3892267' })
    expect(rows.operator).toMatchObject({ suggestion: 'Naturpark Haßberge e. V.' })
  })

  test('marks different values and gives no suggestion when Wikidata has one', () => {
    const rows = byId(
      wikidataFieldRows(
        { qid: 'Q1', label: 'Anderer Name', wdpa: ['1'], osmRelation: ['2'] },
        context,
      ),
    )
    expect(rows.label?.status).toBe('different')
    expect(rows.wdpa).toMatchObject({ status: 'different' })
    expect(rows.wdpa?.suggestion).toBeUndefined()
    expect(rows.osmRelation).toMatchObject({ status: 'different' })
  })

  test('has nothing to compare without a matched OSM object', () => {
    const rows = byId(
      wikidataFieldRows(
        { qid: 'Q1', osmRelation: ['2'] },
        { official: null, osm: null, osmRelationId: '' },
      ),
    )
    expect(rows.osmRelation).toMatchObject({ status: 'none' })
    expect(rows.label?.suggestion).toBeUndefined()
  })
})

describe('normalizeWebsite', () => {
  test('ignores scheme, www, query and trailing slash', () => {
    expect(normalizeWebsite('HTTPS://www.Example.org/path/?a=1#x')).toBe('example.org/path')
  })
})
