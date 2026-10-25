import { describe, expect, test } from 'bun:test'
import type { Feature, MultiPolygon, Point } from 'geojson'
import {
  matchProtectedAreaCandidates,
  normalizeProtectedAreaName,
  protectedAreaNameSimilarity,
} from './protectedAreaCandidates.ts'

function point(lng: number, lat: number, props: Record<string, unknown>): Feature<Point> {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lng, lat] },
    properties: props,
  }
}

const SQUARE: MultiPolygon = {
  type: 'MultiPolygon',
  coordinates: [
    [
      [
        [10, 50],
        [10.1, 50],
        [10.1, 50.1],
        [10, 50.1],
        [10, 50],
      ],
    ],
  ],
}

function row(properties: Record<string, unknown>) {
  return {
    canonicalMatchKey: '111',
    officialGeometryWgs84: SQUARE,
    officialProperties: { wdpa: '111', name: 'Hochwald', category_id: 2, ...properties },
  }
}

describe('name similarity', () => {
  test('ignores type words, case, diacritics and punctuation', () => {
    expect(normalizeProtectedAreaName('NSG „Hochwäld“ (Naturschutzgebiet)')).toBe('hochwald')
    expect(protectedAreaNameSimilarity('Hochwald', 'NSG Hochwald')).toBe(1)
    expect(protectedAreaNameSimilarity('Hochwald', 'Tiefer See')).toBeLessThan(0.5)
    expect(protectedAreaNameSimilarity(null, 'x')).toBe(0)
  })
})

describe('matchProtectedAreaCandidates', () => {
  const nsgTags = {
    boundary: 'protected_area',
    protect_class: '4',
    protection_title: 'Naturschutzgebiet',
  }

  test('dtp_id and dtp_osm_ref find candidates anywhere and rank first', () => {
    const far = point(5, 45, { osm_id: '1', name: 'Anders', dtp_id: 'AAA-1', ...nsgTags })
    const refFar = point(6, 46, { osm_id: '2', name: 'Weit weg' })
    const inside = point(10.05, 50.05, { osm_id: '3', name: 'Hochwald', ...nsgTags })
    const out = matchProtectedAreaCandidates({
      rows: [row({ dtp_uuid: 'aaa-1', dtp_osm_ref: 'relation/2' })],
      officialKeySet: new Set(['111']),
      candidatePoints: [inside, refFar, far],
    })
    const candidates = out.get('111')!
    expect(candidates.map((c) => c.osmId)).toEqual(['1', '2', '3'])
    expect(candidates[0]!.signals).toEqual(['dtp_id'])
    expect(candidates[1]!.signals).toEqual(['dtp_osm_ref'])
    expect(candidates[2]!.signals).toEqual(['inside', 'name'])
    expect(candidates[2]!.suggestedTags).toEqual({ 'ref:WDPA': '111' })
  })

  test('wikidata and natura2000 signals add wikidata/ref:DE suggestions', () => {
    const byQ = point(7, 47, { osm_id: '4', name: 'X', wikidata: 'Q5' })
    const bySite = point(8, 48, {
      osm_id: '5',
      name: 'Y',
      'ref:DE': '7148-371',
      protect_class: '97',
    })
    const out = matchProtectedAreaCandidates({
      rows: [
        {
          ...row({ category_id: 7, wikidata: 'Q9', natura2000_code: 'DE7148371' }),
        },
      ],
      officialKeySet: new Set(['111']),
      candidatePoints: [byQ, bySite],
    })
    const candidates = out.get('111')!
    expect(candidates.map((c) => c.signals)).toEqual([['natura2000']])
    const noWikidata = matchProtectedAreaCandidates({
      rows: [row({ category_id: 7, wikidata: 'Q9', natura2000_code: 'DE7148371' })],
      officialKeySet: new Set(['111']),
      candidatePoints: [bySite],
    }).get('111')![0]!
    expect(noWikidata.suggestedTags).toEqual({ 'ref:WDPA': '111', wikidata: 'Q9' })
  })

  test('type scope restricts the spatial signal, drops objects matched to another row', () => {
    const wrongType = point(10.05, 50.05, { osm_id: '6', name: 'Etwas', protect_class: '5' })
    const taken = point(10.04, 50.04, {
      osm_id: '7',
      name: 'Hochwald',
      'ref:WDPA': '222',
      ...nsgTags,
    })
    const out = matchProtectedAreaCandidates({
      rows: [row({})],
      officialKeySet: new Set(['111', '222']),
      candidatePoints: [wrongType, taken],
    })
    expect(out.get('111')).toEqual([])
  })

  test('name signal needs proximity and caps at five candidates', () => {
    const near = point(10.11, 50.05, { osm_id: '8', name: 'Hochwald', ...nsgTags })
    const farAway = point(12, 52, { osm_id: '9', name: 'Hochwald', ...nsgTags })
    const out = matchProtectedAreaCandidates({
      rows: [row({})],
      officialKeySet: new Set(['111']),
      candidatePoints: [near, farAway],
    })
    expect(out.get('111')!.map((c) => c.osmId)).toEqual(['8'])

    const many = Array.from({ length: 9 }, (_, i) =>
      point(10.05, 50.05, { osm_id: String(100 + i), name: 'Hochwald', ...nsgTags }),
    )
    const capped = matchProtectedAreaCandidates({
      rows: [row({})],
      officialKeySet: new Set(['111']),
      candidatePoints: many,
    })
    expect(capped.get('111')).toHaveLength(5)
  })
})
