import { describe, expect, test, vi } from 'vitest'
import type { ComparisonForReport } from '../types/report'
import { handleComparisonMapFeatureClick } from './comparisonMapFeatureClick'

const data = {
  rows: [
    { canonicalMatchKey: 'A', category: 'official_only', nameLabel: 'A' },
    { canonicalMatchKey: 'B', category: 'official_only', nameLabel: 'B' },
  ],
  unmatchedOsm: [{ canonicalMatchKey: 'X', nameLabel: 'X' }],
} as unknown as ComparisonForReport

function click(featureKeys: string[]) {
  const navigate = vi.fn()
  const onOverlapPick = vi.fn()
  handleComparisonMapFeatureClick({ featureKeys, areaKey: 'ds', data, navigate, onOverlapPick })
  return { navigate, onOverlapPick }
}

describe('handleComparisonMapFeatureClick', () => {
  test('opens the compare page for exactly one official-only and one unmatched OSM area', () => {
    const { navigate, onOverlapPick } = click(['X', 'A'])
    expect(navigate).toHaveBeenCalledWith({
      to: '/$areaId/compare/$officialKey/$osmKey',
      params: { areaId: 'ds', officialKey: 'A', osmKey: 'X' },
    })
    expect(onOverlapPick).not.toHaveBeenCalled()
  })

  test('keeps the picker for more than two overlapping areas', () => {
    const { navigate, onOverlapPick } = click(['A', 'B', 'X'])
    expect(onOverlapPick).toHaveBeenCalledWith(['A', 'B', 'X'])
    expect(navigate).not.toHaveBeenCalled()
  })
})
