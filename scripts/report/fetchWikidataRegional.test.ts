import { describe, expect, test } from 'bun:test'
import { mergeBindings } from './fetchWikidataRegional.ts'

function binding(ars: string, qid: string, pop?: string, date?: string) {
  return {
    ars: { value: ars },
    qid: { value: qid },
    ...(pop ? { pop: { value: pop } } : {}),
    ...(date ? { date: { value: date } } : {}),
  }
}

describe('mergeBindings', () => {
  test('keeps the BestRank population with the latest P585 when an ARS repeats', () => {
    const merged = mergeBindings([
      binding('010010000000', 'Q3798', '99307', '2024-12-31T00:00:00Z'),
      binding('010010000000', 'Q3798', '95568', '2025-12-31T00:00:00Z'),
    ])
    expect(merged.duplicateArsCount).toBe(1)
    expect(merged.byArs['010010000000']).toEqual({
      qid: 'Q3798',
      pop: 95568,
      date: '2025-12-31',
    })
  })
})
