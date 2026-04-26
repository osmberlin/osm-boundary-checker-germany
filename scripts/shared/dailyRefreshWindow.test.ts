import { describe, expect, test } from 'bun:test'
import { decideDailyRefresh } from './dailyRefreshWindow.ts'

describe('decideDailyRefresh', () => {
  test('uses cache before the local 01:00 refresh boundary', () => {
    const decision = decideDailyRefresh({
      force: false,
      cacheExists: true,
      cachedAt: '2026-04-26T20:30:00.000Z',
      now: new Date('2026-04-26T22:30:00.000Z'),
      timezone: 'Europe/Berlin',
    })
    expect(decision.shouldDownload).toBe(false)
    expect(decision.reason).toBe('cache_used_current_window')
    expect(decision.currentWindowKey).toBe('2026-04-26')
    expect(decision.cachedWindowKey).toBe('2026-04-26')
  })

  test('re-downloads after 01:00 in a new local refresh window', () => {
    const decision = decideDailyRefresh({
      force: false,
      cacheExists: true,
      cachedAt: '2026-04-26T20:30:00.000Z',
      now: new Date('2026-04-26T23:30:00.000Z'),
      timezone: 'Europe/Berlin',
    })
    expect(decision.shouldDownload).toBe(true)
    expect(decision.reason).toBe('cache_stale_previous_window')
    expect(decision.currentWindowKey).toBe('2026-04-27')
    expect(decision.cachedWindowKey).toBe('2026-04-26')
  })

  test('forces download when force flag is provided', () => {
    const decision = decideDailyRefresh({
      force: true,
      cacheExists: true,
      cachedAt: '2026-04-26T22:30:00.000Z',
      now: new Date('2026-04-27T00:30:00.000Z'),
      timezone: 'Europe/Berlin',
    })
    expect(decision.shouldDownload).toBe(true)
    expect(decision.reason).toBe('force')
  })

  test('skips download and keeps cache when timestamp is invalid', () => {
    const decision = decideDailyRefresh({
      force: false,
      cacheExists: true,
      cachedAt: 'not-a-date',
      now: new Date('2026-04-27T10:00:00.000Z'),
      timezone: 'Europe/Berlin',
    })
    expect(decision.shouldDownload).toBe(false)
    expect(decision.reason).toBe('cache_used_invalid_cached_at')
  })
})
