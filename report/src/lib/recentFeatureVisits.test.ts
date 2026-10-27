import { describe, expect, it } from 'vitest'
import {
  pruneRecentVisits,
  RECENT_VISIT_MAX_AGE_MS,
  type RecentFeatureVisit,
} from './recentFeatureVisits'

function visit(featureKey: string, visitedAt: number, areaId = 'vg'): RecentFeatureVisit {
  return { areaId, featureKey, category: 'unmatched_osm', name: featureKey, visitedAt }
}

describe('pruneRecentVisits', () => {
  const now = 10 * RECENT_VISIT_MAX_AGE_MS

  it('drops visits older than the max age', () => {
    const kept = pruneRecentVisits(
      [visit('old', now - RECENT_VISIT_MAX_AGE_MS - 1), visit('new', now - 1000)],
      now,
    )
    expect(kept.map((v) => v.featureKey)).toEqual(['new'])
  })

  it('keeps only the newest visit of a row, newest first', () => {
    const kept = pruneRecentVisits(
      [visit('a', now - 3000), visit('b', now - 2000), visit('a', now - 1000)],
      now,
    )
    expect(kept.map((v) => [v.featureKey, v.visitedAt])).toEqual([
      ['a', now - 1000],
      ['b', now - 2000],
    ])
  })

  it('treats the same key in two datasets as two rows', () => {
    const kept = pruneRecentVisits([visit('a', now - 2000, 'x'), visit('a', now - 1000, 'y')], now)
    expect(kept).toHaveLength(2)
  })

  it('keeps at most 50 rows per dataset', () => {
    const many = Array.from({ length: 60 }, (_, i) => visit(`k${i}`, now - i))
    expect(pruneRecentVisits(many, now)).toHaveLength(50)
  })
})
