import { describe, expect, it } from 'vitest'
import { isOlderThanDays } from './dataAge'

describe('isOlderThanDays', () => {
  it('flags timestamps older than threshold', () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
    expect(isOlderThanDays(tenDaysAgo, 5)).toBe(true)
  })

  it('does not flag recent timestamps', () => {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    expect(isOlderThanDays(oneDayAgo, 5)).toBe(false)
  })

  it('returns false for invalid values', () => {
    expect(isOlderThanDays(null, 5)).toBe(false)
    expect(isOlderThanDays('invalid', 5)).toBe(false)
  })
})
