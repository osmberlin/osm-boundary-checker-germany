import { describe, expect, test } from 'bun:test'
import type { RegionalHubWikidataFile } from '../shared/regionalHubPayload.ts'
import { shouldSkipWikidataFetch } from './fetchWikidataRegional.ts'

const HASH = 'abc123def4567890'
const NOW_MS = Date.parse('2026-09-04T12:00:00.000Z')

function dump(overrides: Partial<RegionalHubWikidataFile> = {}): RegionalHubWikidataFile {
  return {
    generatedAt: '2026-09-01T12:00:00.000Z',
    queryHash: HASH,
    durationMs: 100,
    rowCount: 1,
    duplicateArsCount: 0,
    byArs: { '120510000000': { qid: 'Q3931' } },
    ...overrides,
  }
}

describe('shouldSkipWikidataFetch', () => {
  test('fresh successful dump → true', () => {
    expect(shouldSkipWikidataFetch(dump(), HASH, NOW_MS)).toBe(true)
  })

  test('force → false', () => {
    expect(shouldSkipWikidataFetch(dump(), HASH, NOW_MS, true)).toBe(false)
  })

  test('queryHash mismatch → false', () => {
    expect(shouldSkipWikidataFetch(dump(), 'other-hash', NOW_MS)).toBe(false)
  })

  test('skipReason last_good_fallback → false', () => {
    expect(
      shouldSkipWikidataFetch(dump({ skipReason: 'wikidata_last_good_fallback' }), HASH, NOW_MS),
    ).toBe(false)
  })

  test('skipReason wikidata_fetch_failed → false', () => {
    expect(
      shouldSkipWikidataFetch(dump({ skipReason: 'wikidata_fetch_failed' }), HASH, NOW_MS),
    ).toBe(false)
  })

  test('missing generatedAt → false', () => {
    const { generatedAt: _generatedAt, ...rest } = dump()
    expect(shouldSkipWikidataFetch(rest as RegionalHubWikidataFile, HASH, NOW_MS)).toBe(false)
  })
})
