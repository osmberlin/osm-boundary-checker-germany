import { describe, expect, test } from 'bun:test'
import { computeProtectedAreaAttributeHints } from './protectedAreaHints.ts'

describe('computeProtectedAreaAttributeHints', () => {
  test('well-tagged NSG has no hints', () => {
    expect(
      computeProtectedAreaAttributeHints({
        officialProperties: { category_id: 2, wikidata: 'Q1', dtp_osm_ref: 'relation/5' },
        osmProperties: {
          '@id': 'relation/5',
          protect_class: '4',
          protection_title: 'Naturschutzgebiet',
          wikidata: 'Q1',
        },
      }),
    ).toEqual([])
  })

  test('reports type tags, wikidata, osm ref and natura 2000 code', () => {
    const hints = computeProtectedAreaAttributeHints({
      officialProperties: {
        category_id: 7,
        wikidata: 'Q60',
        dtp_osm_ref: 'relation/9',
        natura2000_code: 'DE7148371',
      },
      osmProperties: { '@id': 'relation/5', protect_class: '4', wikidata: 'Q1' },
    })
    expect(hints.map((h) => h.id)).toEqual([
      'type_tags',
      'wikidata_differs',
      'osm_ref_differs',
      'natura2000_missing',
    ])
    expect(hints[0]!.actual).toEqual(['protect_class=4'])
    expect(hints[3]!.suggestedTags).toEqual({ 'ref:DE': '7148-371' })
  })

  test('missing wikidata suggests the DtP value, matching ref:SCI satisfies natura check', () => {
    const hints = computeProtectedAreaAttributeHints({
      officialProperties: { category_id: 7, wikidata: 'Q60', natura2000_code: 'DE7148371' },
      osmProperties: { protect_class: '97', 'ref:SCI': 'DE 7148-371' },
    })
    expect(hints.map((h) => h.id)).toEqual(['wikidata_missing'])
    expect(hints[0]!.suggestedTags).toEqual({ wikidata: 'Q60' })
  })
})
