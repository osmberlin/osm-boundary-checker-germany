import { describe, expect, test } from 'bun:test'
import { GERMAN_STATES, germanStateByArsPrefix, statesFromOverlaps } from './germanStates.ts'

describe('statesFromOverlaps', () => {
  test('main state first, then others above the area or share threshold', () => {
    expect(
      statesFromOverlaps(
        [
          { code: 'BB', areaM2: 30_000 },
          { code: 'ST', areaM2: 9_000_000 },
          { code: 'SN', areaM2: 60_000 },
        ],
        9_090_000,
      ),
    ).toEqual(['ST', 'SN'])
  })

  test('a small area keeps a neighbour that holds a tenth of it', () => {
    expect(
      statesFromOverlaps(
        [
          { code: 'HE', areaM2: 80_000 },
          { code: 'TH', areaM2: 20_000 },
        ],
        100_000,
      ),
    ).toEqual(['HE', 'TH'])
  })

  test('slivers below both thresholds are dropped', () => {
    expect(
      statesFromOverlaps(
        [
          { code: 'SH', areaM2: 6_000_000 },
          { code: 'MV', areaM2: 12_000 },
        ],
        6_012_000,
      ),
    ).toEqual(['SH'])
  })

  test('no overlap gives no state (e.g. offshore EEZ sites)', () => {
    expect(statesFromOverlaps([], 1_000_000)).toEqual([])
  })
})

test('codes and ARS prefixes are unique', () => {
  expect(new Set(GERMAN_STATES.map((s) => s.code)).size).toBe(16)
  expect(germanStateByArsPrefix('12')?.code).toBe('BB')
})
