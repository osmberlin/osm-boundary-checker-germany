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

  test('ref:WDPA only on one side is reported, equal or contained values are not', () => {
    const idsFor = (wdpa: string, osmWdpa: string) =>
      computeProtectedAreaAttributeHints({
        officialProperties: { category_id: 4, wdpa },
        osmProperties: {
          protection_title: 'Naturpark',
          ...(osmWdpa ? { 'ref:WDPA': osmWdpa } : {}),
        },
      })
    const missingInDtp = idsFor('', '555')
    expect(missingInDtp.map((h) => h.id)).toEqual(['wdpa_missing_in_dtp'])
    expect(missingInDtp[0]!.actual).toEqual(['ref:WDPA=555'])
    // The reference data lacks the id: a note for the reference data, not a suggestion for OSM.
    expect(missingInDtp[0]!.target).toBe('reference')
    const missingInOsm = idsFor('555', '')
    expect(missingInOsm.map((h) => h.id)).toEqual(['wdpa_missing_in_osm'])
    expect(missingInOsm[0]!.suggestedTags).toEqual({ 'ref:WDPA': '555' })
    expect(missingInOsm[0]!.target).toBe('osm')
    expect(idsFor('555', '666').map((h) => h.id)).toEqual(['wdpa_differs'])
    expect(idsFor('555', '555')).toEqual([])
    expect(idsFor('555', '444; 555')).toEqual([])
  })
})
