import { describe, expect, test } from 'bun:test'
import type { FeatureCollection } from 'geojson'
import { unionFeaturesByKey } from './geoMerge.ts'

describe('unionFeaturesByKey', () => {
  test('empty collection', () => {
    const fc: FeatureCollection = { type: 'FeatureCollection', features: [] }
    const m = unionFeaturesByKey(fc, () => 'a')
    expect(m.size).toBe(0)
  })

  test('keeps properties from first feature per key', () => {
    const fc: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { id: '1', name: 'first' },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [0, 0],
                [1, 0],
                [1, 1],
                [0, 1],
                [0, 0],
              ],
            ],
          },
        },
        {
          type: 'Feature',
          properties: { id: '1', name: 'second' },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [2, 0],
                [3, 0],
                [3, 1],
                [2, 1],
                [2, 0],
              ],
            ],
          },
        },
      ],
    }
    const m = unionFeaturesByKey(fc, (p) => String((p as { id: string }).id))
    const kg = m.get('1')
    expect(kg?.properties).toEqual({ id: '1', name: 'first' })
  })
})
