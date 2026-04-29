import { describe, expect, test } from 'bun:test'
import type { Polygon } from 'geojson'
import { projectGeometry } from '../projectGeometry.ts'
import {
  classifyIssueIndicator,
  computeBaselineAnomalies,
  withRobustBoundaryMetrics,
} from './issueIndicator.ts'
import type { MetricResult } from './types.ts'

const CRS = 'EPSG:25832'

function square(lon: number, lat: number, size: number): Polygon {
  return {
    type: 'Polygon',
    coordinates: [
      [
        [lon, lat],
        [lon + size, lat],
        [lon + size, lat + size],
        [lon, lat + size],
        [lon, lat],
      ],
    ],
  }
}

describe('withRobustBoundaryMetrics', () => {
  test('adds Hausdorff P95 and normalized distance', () => {
    const official = projectGeometry(square(13.4, 52.5, 0.03), CRS)
    const osm = projectGeometry(square(13.401, 52.501, 0.03), CRS)
    if (official.type !== 'Polygon' && official.type !== 'MultiPolygon')
      throw new Error('poly only')
    if (osm.type !== 'Polygon' && osm.type !== 'MultiPolygon') throw new Error('poly only')
    const base: MetricResult = {
      iou: 0.95,
      areaDiffPct: 0.1,
      symmetricDiffPct: 0.2,
      hausdorffM: 100,
      officialAreaM2: 1_000_000,
      osmAreaM2: 1_000_000,
    }
    const out = withRobustBoundaryMetrics(base, official, osm)
    expect(Number.isFinite(out.hausdorffP95M ?? Number.NaN)).toBe(true)
    expect(Number.isFinite(out.hausdorffNorm ?? Number.NaN)).toBe(true)
  })
})

describe('classifyIssueIndicator', () => {
  test('keeps strong-overlap case as ok', () => {
    const out = classifyIssueIndicator({
      iou: 0.998,
      areaDiffPct: 0.1,
      symmetricDiffPct: 0.1,
      hausdorffM: 33_000,
      hausdorffP95M: 200,
      hausdorffNorm: 0.01,
      officialAreaM2: 5_000_000,
      osmAreaM2: 5_010_000,
    })
    expect(out.level).toBe('ok')
    expect(out.reasons).toContain('STRONG_OVERLAP_LOW_DIFF')
  })
})

describe('computeBaselineAnomalies', () => {
  test('flags a large delta as baseline anomaly', () => {
    const rows = Array.from({ length: 12 }, (_, i) => {
      const mild = i < 11
      return {
        key: `k${i}`,
        current: {
          iou: mild ? 0.99 : 0.7,
          areaDiffPct: mild ? 0.2 : 8,
          symmetricDiffPct: mild ? 0.2 : 9,
          hausdorffM: mild ? 120 : 1200,
          hausdorffNorm: mild ? 0.01 : 0.2,
          officialAreaM2: 1_000_000,
          osmAreaM2: 1_000_000,
        } satisfies MetricResult,
        previous: {
          iou: 0.99,
          areaDiffPct: 0.2,
          symmetricDiffPct: 0.2,
          hausdorffM: 120,
          hausdorffNorm: 0.01,
          officialAreaM2: 1_000_000,
          osmAreaM2: 1_000_000,
        } satisfies MetricResult,
      }
    })
    const anomalies = computeBaselineAnomalies(rows)
    const outlierReasons = anomalies.get('k11') ?? []
    expect(outlierReasons.length > 0).toBe(true)
  })
})
