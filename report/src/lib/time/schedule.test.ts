import { describe, expect, it } from 'vitest'
import { berlinCalendarDateKey, timelineDateKeys } from './calendar'
import { isScheduledRefreshDay, scheduledRefreshAtIso, scheduledSlotsInRange } from './schedule'

describe('isScheduledRefreshDay', () => {
  it('is true for Sunday', () => {
    expect(isScheduledRefreshDay('2026-06-07')).toBe(true)
  })

  it('is false for Monday', () => {
    expect(isScheduledRefreshDay('2026-06-08')).toBe(false)
  })

  it('is true for Wednesday', () => {
    expect(isScheduledRefreshDay('2026-06-10')).toBe(true)
  })
})

describe('scheduledRefreshAtIso', () => {
  it('returns 04:00 Berlin as ISO', () => {
    const iso = scheduledRefreshAtIso('2026-06-07')
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    expect(berlinCalendarDateKey(iso)).toBe('2026-06-07')
  })
})

describe('scheduledSlotsInRange', () => {
  it('includes only refresh weekdays in range', () => {
    const keys = timelineDateKeys('2026-06-01')
    const slots = scheduledSlotsInRange(keys[0]!, keys[keys.length - 1]!)
    for (const slot of slots) {
      expect(isScheduledRefreshDay(slot.dateKey)).toBe(true)
    }
    expect(slots.length).toBeGreaterThan(0)
  })
})
