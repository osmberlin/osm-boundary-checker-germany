import { describe, expect, it } from 'vitest'
import {
  addBerlinDateKeyDays,
  berlinCalendarDateKey,
  berlinTodayDateKey,
  berlinWeekdayFromDateKey,
  timelineDateKeys,
} from './calendar'

describe('berlinCalendarDateKey', () => {
  it('returns YYYY-MM-DD in Europe/Berlin', () => {
    expect(berlinCalendarDateKey('2026-04-02T12:00:00.000Z')).toBe('2026-04-02')
  })

  it('rolls UTC midnight into the next Berlin calendar day when offset crosses', () => {
    expect(berlinCalendarDateKey('2026-04-02T22:00:00.000Z')).toBe('2026-04-03')
  })

  it('returns empty string for invalid ISO', () => {
    expect(berlinCalendarDateKey('not-a-date')).toBe('')
  })
})

describe('timelineDateKeys', () => {
  it('returns 21 days centered on center key', () => {
    const keys = timelineDateKeys('2026-06-01')
    expect(keys).toHaveLength(21)
    expect(keys[0]).toBe('2026-05-22')
    expect(keys[10]).toBe('2026-06-01')
    expect(keys[20]).toBe('2026-06-11')
  })
})

describe('addBerlinDateKeyDays', () => {
  it('adds calendar days', () => {
    expect(addBerlinDateKeyDays('2026-06-01', 1)).toBe('2026-06-02')
  })
})

describe('berlinWeekdayFromDateKey', () => {
  it('returns Sunday for 2026-06-07', () => {
    expect(berlinWeekdayFromDateKey('2026-06-07')).toBe(0)
  })
})

describe('berlinTodayDateKey', () => {
  it('returns a valid key', () => {
    expect(berlinTodayDateKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
