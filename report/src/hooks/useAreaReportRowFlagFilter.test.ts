import { expect, test } from 'vitest'
import { matchesRowFlagFilters, parseRowFlagFilters } from './useAreaReportRowFlagFilter'

test('parses only valid flag modes', () => {
  expect(parseRowFlagFilters('managed:only,x:all,bad,y:hide')).toEqual({
    managed: 'only',
    y: 'hide',
  })
  expect(parseRowFlagFilters(undefined)).toEqual({})
})

test('only keeps flagged rows, hide drops them', () => {
  const flagged = { flags: ['managed'] } as never
  const plain = {} as never
  expect(matchesRowFlagFilters(flagged, { managed: 'only' })).toBe(true)
  expect(matchesRowFlagFilters(plain, { managed: 'only' })).toBe(false)
  expect(matchesRowFlagFilters(flagged, { managed: 'hide' })).toBe(false)
  expect(matchesRowFlagFilters(plain, { managed: 'hide' })).toBe(true)
})
