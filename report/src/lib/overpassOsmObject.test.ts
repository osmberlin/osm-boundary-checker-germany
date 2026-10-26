import { describe, expect, test } from 'vitest'
import {
  buildOverpassObjectQuery,
  mergeOverpassGeojson,
  parseOverpassObjectData,
} from './overpassOsmObject'

const wayResponse = JSON.stringify({
  elements: [
    {
      type: 'way',
      id: 7,
      tags: { name: 'Heide', boundary: 'protected_area' },
      geometry: [
        { lat: 52, lon: 13 },
        { lat: 52, lon: 13.1 },
        { lat: 52.1, lon: 13.1 },
        { lat: 52, lon: 13 },
      ],
    },
  ],
})

describe('buildOverpassObjectQuery', () => {
  test('selects one element with geometry', () => {
    expect(buildOverpassObjectQuery({ type: 'relation', id: 42 })).toBe(
      '[out:json][timeout:25];\nrelation(42);\nout geom;',
    )
  })
})

describe('parseOverpassObjectData', () => {
  test('returns tags and geometry of the element', () => {
    const parsed = parseOverpassObjectData(wayResponse, { type: 'way', id: 7 })
    expect(parsed.tags).toEqual({ name: 'Heide', boundary: 'protected_area' })
    expect(parsed.features).toHaveLength(1)
  })

  test('an element that is gone has no tags and no geometry', () => {
    const parsed = parseOverpassObjectData('{"elements":[]}', { type: 'way', id: 7 })
    expect(parsed).toEqual({ tags: null, features: [] })
  })

  test('rejects text that is not Overpass JSON', () => {
    expect(() => parseOverpassObjectData('<html>', { type: 'way', id: 7 })).toThrow(
      'INVALID_OVERPASS_JSON',
    )
  })
})

describe('mergeOverpassGeojson', () => {
  test('keeps one feature per OSM object', () => {
    const { features } = parseOverpassObjectData(wayResponse, { type: 'way', id: 7 })
    const merged = mergeOverpassGeojson([{ features }, { features }, null])
    expect(merged?.features).toHaveLength(1)
    expect(mergeOverpassGeojson([null])).toBeNull()
  })
})
