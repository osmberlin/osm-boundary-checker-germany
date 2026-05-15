import { describe, expect, test } from 'bun:test'
import {
  COMPARISON_DIFF_EMPTY_PLACEHOLDER_FEATURE_ID,
  comparisonDiffPlaceholderFeatureCollection,
} from './comparisonDiffPlaceholder.ts'

describe('comparisonDiffPlaceholderFeatureCollection', () => {
  test('returns one diff Point at bbox north-east with sentinel id', () => {
    const west = 9
    const south = 53
    const east = 10
    const north = 54
    const fc = comparisonDiffPlaceholderFeatureCollection([west, south, east, north])
    expect(fc.features).toHaveLength(1)
    const f = fc.features[0]!
    expect(f.properties?.featureId).toBe(COMPARISON_DIFF_EMPTY_PLACEHOLDER_FEATURE_ID)
    expect(f.properties?.mapRole).toBe('diff')
    expect(f.properties?.boundarySource).toBe('external')
    expect(f.geometry?.type).toBe('Point')
    if (f.geometry?.type === 'Point') {
      expect(f.geometry.coordinates).toEqual([east, north])
    }
  })
})
