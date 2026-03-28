import { describe, expect, test } from 'bun:test'
import type { Polygon } from 'geojson'
import { projectGeometry } from './projectGeometry.ts'

describe('projectGeometry', () => {
  test('EPSG:32633 preserves finite coordinates', () => {
    const p: Polygon = {
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
    const q = projectGeometry(p, 'EPSG:32633')
    expect(q.type).toBe('Polygon')
    const ring = (q as Polygon).coordinates[0]
    expect(Number.isFinite(ring[0]![0])).toBe(true)
    expect(Number.isFinite(ring[0]![1])).toBe(true)
  })

  test('EPSG:25832 preserves finite coordinates', () => {
    const p: Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [9.0, 50.0],
          [9.01, 50.0],
          [9.01, 50.01],
          [9.0, 50.01],
          [9.0, 50.0],
        ],
      ],
    }
    const q = projectGeometry(p, 'EPSG:25832')
    expect(q.type).toBe('Polygon')
    const ring = (q as Polygon).coordinates[0]
    expect(Number.isFinite(ring[0]![0])).toBe(true)
    expect(Number.isFinite(ring[0]![1])).toBe(true)
  })
})
