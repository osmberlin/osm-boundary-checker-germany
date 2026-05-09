import { describe, expect, test } from 'bun:test'
import * as turf from '@turf/turf'
import type { Feature, Polygon } from 'geojson'
import { featureBBox } from './featureBBox.ts'

describe('featureBBox', () => {
  test('uses GDAL _bbox_* properties when present', () => {
    const poly: Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [2, 0],
          [2, 2],
          [0, 2],
          [0, 0],
        ],
      ],
    }
    const f: Feature = {
      type: 'Feature',
      properties: { _bbox_minx: 10, _bbox_miny: 20, _bbox_maxx: 30, _bbox_maxy: 40 },
      geometry: poly,
    }
    expect(featureBBox(f)).toEqual([10, 20, 30, 40])
  })

  test('falls back to turf.bbox when props missing', () => {
    const f = turf.polygon([
      [
        [9, 50],
        [9.1, 50],
        [9.1, 50.1],
        [9, 50.1],
        [9, 50],
      ],
    ])
    expect(featureBBox(f)).toEqual(turf.bbox(f))
  })
})
