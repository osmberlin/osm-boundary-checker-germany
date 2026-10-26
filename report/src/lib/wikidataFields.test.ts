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

describe('wikidataFieldRows area', () => {
  const base = { official: null, osm: null, osmRelationId: '' }
  const areaRow = (areaHa: number | undefined, official: number | null, osm: number | null) =>
    byId(
      wikidataFieldRows(
        { qid: 'Q1', ...(areaHa === undefined ? {} : { areaHa }) },
        { ...base, areaHa: { official, osm }, officialGeometryLabel: 'DtP-Geometrie' },
      ),
    ).area!

  test('equal within 5 percent, different beyond', () => {
    expect(areaRow(81706, 81665.77, 81665.21).status).toBe('equal')
    expect(areaRow(104, 100, null).status).toBe('equal')
    expect(areaRow(106, 100, null).status).toBe('different')
    expect(areaRow(90, 100, null).status).toBe('different')
  })

  test('tooltip values name the geometry and OSM', () => {
    expect(areaRow(100, 100, 99.5).compared).toEqual([
      { source: 'official', key: '', value: '100 ha', label: 'DtP-Geometrie' },
      { source: 'osm', key: '', value: '99,5 ha' },
    ])
  })

  test('no marker without an official area, a suggestion when Wikidata has none', () => {
    expect(areaRow(100, null, null)).toMatchObject({ status: 'none', compared: [] })
    expect(areaRow(undefined, 1234.5, null)).toMatchObject({
      status: 'none',
      suggestion: '1.234,5 ha',
    })
    expect(areaRow(undefined, null, null).suggestion).toBeUndefined()
  })
})
