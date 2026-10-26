import { describe, expect, test } from 'bun:test'
import { computeProtectedAreaAttributeHints } from './protectedAreaHints.ts'

describe('computeProtectedAreaAttributeHints', () => {
  test('same object has no hints', () => {
    expect(
      computeProtectedAreaAttributeHints({
        officialProperties: { category_id: 2, wikidata: 'Q1', dtp_osm_ref: 'relation/5' },
        osmProperties: { '@id': 'relation/5', wikidata: 'Q1' },
      }),
    ).toEqual([])
  })

  test('reports a DtP reference to another OSM object', () => {
    const hints = computeProtectedAreaAttributeHints({
      officialProperties: { dtp_osm_ref: 'relation/9' },
      osmProperties: { '@id': 'relation/5' },
    })
    expect(hints).toEqual([
      { id: 'osm_ref_differs', target: 'osm', expected: ['relation/9'], actual: ['relation/5'] },
    ])
  })

  test('tag differences are left to the attribute checks', () => {
    expect(
      computeProtectedAreaAttributeHints({
        officialProperties: {
          category_id: 7,
          wikidata: 'Q60',
          wdpa: '555',
          natura2000_code: 'DE7148371',
        },
        osmProperties: { protect_class: '4', wikidata: 'Q1', 'ref:WDPA': '666' },
      }),
    ).toEqual([])
  })

  test('no hints without a DtP reference or an OSM id', () => {
    expect(
      computeProtectedAreaAttributeHints({
        officialProperties: { dtp_osm_ref: 'relation/9' },
        osmProperties: {},
      }),
    ).toEqual([])
    expect(
      computeProtectedAreaAttributeHints({ officialProperties: null, osmProperties: {} }),
    ).toEqual([])
  })
})
