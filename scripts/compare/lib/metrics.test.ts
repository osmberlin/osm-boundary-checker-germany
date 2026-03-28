import { describe, expect, test } from 'bun:test'
import type { Polygon } from 'geojson'
import { calculateMetrics } from './metrics.ts'
import { projectGeometry } from './projectGeometry.ts'

const crs = 'EPSG:32633'

describe('calculateMetrics', () => {
  test('identical squares in projected CRS → IoU ~ 1', () => {
    const square: Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [13.4, 52.5],
          [13.41, 52.5],
          [13.41, 52.51],
          [13.4, 52.51],
          [13.4, 52.5],
        ],
      ],
    }
    const a = projectGeometry(square, crs)
    const b = projectGeometry(square, crs)
    const m = calculateMetrics(a, b)
    expect(m).not.toBeNull()
    expect(m!.iou).toBeGreaterThan(0.99)
  })

  test('disjoint boxes → low IoU', () => {
    const p1: Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [13.0, 52.0],
          [13.01, 52.0],
          [13.01, 52.01],
          [13.0, 52.01],
          [13.0, 52.0],
        ],
      ],
    }
    const p2: Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [14.0, 53.0],
          [14.01, 53.0],
          [14.01, 53.01],
          [14.0, 53.01],
          [14.0, 53.0],
        ],
      ],
    }
    const m = calculateMetrics(projectGeometry(p1, crs), projectGeometry(p2, crs))
    expect(m).not.toBeNull()
    expect(m!.iou).toBeLessThan(0.01)
  })
})
