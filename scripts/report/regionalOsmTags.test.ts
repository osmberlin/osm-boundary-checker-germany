import { describe, expect, test } from 'bun:test'
import type { FeatureCollection } from 'geojson'
import { collectRegionalOsmTags, regionalOsmTagFromFeature } from './regionalOsmTags.ts'

describe('regionalOsmTags', () => {
  test('reads ARS, population tags, and relation id from a feature', () => {
    const parsed = regionalOsmTagFromFeature({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [0, 0] },
      properties: {
        'de:regionalschluessel': '12051',
        '@id': 'relation/62470',
        population: '74113',
        'population:date': '2024-12-31',
        wikidata: 'Q3931',
      },
    })
    expect(parsed).toEqual({
      ars12: '120510000000',
      tag: {
        osmId: 'relation/62470',
        population: '74113',
        populationDate: '2024-12-31',
        wikidata: 'Q3931',
      },
    })
  })

  test('prefers relation over way when the same ARS appears twice', () => {
    const collection: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [0, 0] },
          properties: {
            'de:regionalschluessel': '120510000000',
            osm_way_id: '99',
            population: '1',
          },
        },
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [0, 0] },
          properties: {
            'de:regionalschluessel': '120510000000',
            osm_id: '-62470',
            population: '74113',
          },
        },
      ],
    }
    const tags = collectRegionalOsmTags(collection, '2026-01-01T00:00:00.000Z')
    expect(tags.byArs['120510000000']).toEqual({
      osmId: 'relation/62470',
      population: '74113',
    })
  })
})
