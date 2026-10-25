import { describe, expect, test } from 'bun:test'
import detailFixture from '../fixtures/detail-sample.json'
import listPageFixture from '../fixtures/list-page-sample.json'
import { applyInventory, dedupeListItems, maxUpdatedAt, planDetailFetches } from './plan.ts'
import {
  dtpDetailSchema,
  dtpListPageSchema,
  type DtpCachedRecord,
  type DtpListItem,
} from './schemas.ts'

const NOW = new Date('2026-10-25T12:00:00.000Z')
const DAY = 24 * 60 * 60 * 1000
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY).toISOString()
const detail = dtpDetailSchema.parse(detailFixture)

function item(uuid: string, overrides: Partial<DtpListItem> = {}): DtpListItem {
  return {
    uuid,
    name: `Area ${uuid}`,
    category_id: 2,
    external_references: [],
    parent_uuid: null,
    updated_at: '2026-10-22T06:33:51.540897Z',
    area_in_km2: 1.5,
    ...overrides,
  }
}

function record(uuid: string, overrides: Partial<DtpCachedRecord> = {}): DtpCachedRecord {
  return {
    uuid,
    fetchedAt: daysAgo(1),
    listUpdatedAt: '2026-10-22T06:33:51.540897Z',
    listAreaKm2: 1.5,
    detail,
    ...overrides,
  }
}

describe('planDetailFetches', () => {
  test('fetches a uuid that is not cached yet', () => {
    const plan = planDetailFetches([item('new-1')], [], NOW)
    expect(plan.uuids).toEqual(['new-1'])
    expect(plan.reasons.new).toBe(1)
  })

  test('skips an up-to-date cached record', () => {
    const plan = planDetailFetches([item('a')], [record('a')], NOW)
    expect(plan.uuids).toEqual([])
    expect(plan.dueCount).toBe(0)
  })

  test('fetches when list updated_at differs from listUpdatedAt', () => {
    const plan = planDetailFetches(
      [item('a', { updated_at: '2026-10-24T00:00:00.000Z' })],
      [record('a')],
      NOW,
    )
    expect(plan.uuids).toEqual(['a'])
    expect(plan.reasons.updatedAt).toBe(1)
  })

  test('fetches when area_in_km2 differs from listAreaKm2', () => {
    const plan = planDetailFetches([item('a', { area_in_km2: 1.6 })], [record('a')], NOW)
    expect(plan.uuids).toEqual(['a'])
    expect(plan.reasons.areaKm2).toBe(1)
  })

  test('re-verifies only records older than reverifyDays', () => {
    const inv = [item('old'), item('fresh')]
    const cached = [
      record('old', { fetchedAt: daysAgo(29) }),
      record('fresh', { fetchedAt: daysAgo(27) }),
    ]
    const plan = planDetailFetches(inv, cached, NOW)
    expect(plan.uuids).toEqual(['old'])
    expect(plan.reasons.reverify).toBe(1)
  })

  test('caps re-verify at reverifyMax, oldest fetchedAt first', () => {
    const inv = [item('d30'), item('d40'), item('d50'), item('d35')]
    const cached = [
      record('d30', { fetchedAt: daysAgo(30) }),
      record('d40', { fetchedAt: daysAgo(40) }),
      record('d50', { fetchedAt: daysAgo(50) }),
      record('d35', { fetchedAt: daysAgo(35) }),
    ]
    const plan = planDetailFetches(inv, cached, NOW, { reverifyMax: 2 })
    expect(plan.uuids).toEqual(['d50', 'd40'])
    expect(plan.dueCount).toBe(2)
  })

  test('treats an unreadable fetchedAt as due', () => {
    const plan = planDetailFetches([item('a')], [record('a', { fetchedAt: 'not-a-date' })], NOW)
    expect(plan.uuids).toEqual(['a'])
  })

  test('caps the total at maxDetails and reports the pending count beyond it', () => {
    const inv = [item('n1'), item('n2'), item('n3'), item('n4'), item('n5')]
    const plan = planDetailFetches(inv, [], NOW, { maxDetails: 3 })
    expect(plan.uuids).toEqual(['n1', 'n2', 'n3'])
    expect(plan.dueCount).toBe(5)
  })

  test('puts changed and new uuids before re-verify when the cap applies', () => {
    const inv = [
      item('changed', { updated_at: '2026-10-24T00:00:00.000Z' }),
      item('new'),
      item('stale'),
    ]
    const cached = [record('changed'), record('stale', { fetchedAt: daysAgo(60) })]
    const plan = planDetailFetches(inv, cached, NOW, { maxDetails: 2 })
    expect(plan.uuids).toEqual(['changed', 'new'])
    expect(plan.dueCount).toBe(3)
  })

  test('maxDetails of Infinity fetches everything due', () => {
    const inv = Array.from({ length: 7 }, (_, i) => item(`x${i}`))
    expect(
      planDetailFetches(inv, [], NOW, { maxDetails: Number.POSITIVE_INFINITY }).uuids,
    ).toHaveLength(7)
  })
})

describe('applyInventory', () => {
  test('drops cached records whose uuid left the inventory', () => {
    const { kept, removedCount } = applyInventory(
      [item('a'), item('c')],
      [record('a'), record('b')],
    )
    expect(kept.map((r) => r.uuid)).toEqual(['a'])
    expect(removedCount).toBe(1)
  })
})

describe('dedupeListItems', () => {
  test('keeps the first occurrence of a uuid', () => {
    const first = item('dup', { name: 'first' })
    const second = item('dup', { name: 'second' })
    const { items, duplicateCount } = dedupeListItems([first, item('other'), second])
    expect(items.map((i) => i.name)).toEqual(['first', 'Area other'])
    expect(duplicateCount).toBe(1)
  })
})

describe('maxUpdatedAt', () => {
  test('returns the latest updated_at as ISO instant', () => {
    const inv = [
      item('a', { updated_at: '2026-10-01T00:00:00Z' }),
      item('b', { updated_at: '2026-10-23T07:08:30.760056Z' }),
    ]
    expect(maxUpdatedAt(inv)).toBe('2026-10-23T07:08:30.760Z')
  })

  test('returns null for an empty inventory', () => {
    expect(maxUpdatedAt([])).toBeNull()
  })
})

describe('list fixture as inventory', () => {
  test('plans all three fixture items as new when the cache is empty', () => {
    const inv = dtpListPageSchema.parse(listPageFixture).results
    expect(planDetailFetches(inv, [], NOW).uuids).toHaveLength(3)
  })
})
