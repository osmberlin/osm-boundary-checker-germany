import { describe, expect, test } from 'bun:test'
import { extractFilterWhereClause, normalizeExtractFilter } from './extractFilter.ts'

describe('normalizeExtractFilter', () => {
  test('returns null without filter', () => {
    expect(normalizeExtractFilter(undefined)).toBeNull()
  })

  test('returns null when neither valuePrefix nor excludeValues is usable', () => {
    expect(normalizeExtractFilter({ property: 'BEM' })).toBeNull()
    expect(normalizeExtractFilter({ property: 'BEM', valuePrefix: '  ' })).toBeNull()
    expect(normalizeExtractFilter({ property: 'BEM', excludeValues: [' '] })).toBeNull()
    expect(normalizeExtractFilter({ property: ' ', excludeValues: ['x'] })).toBeNull()
  })

  test('trims property, prefix and excluded values', () => {
    expect(
      normalizeExtractFilter({
        property: ' BEM ',
        excludeValues: [' gemeinschaftsfrei '],
      }),
    ).toEqual({ property: 'BEM', excludeValues: ['gemeinschaftsfrei'] })
    expect(normalizeExtractFilter({ property: 'ARS', valuePrefix: ' 09 ' })).toEqual({
      property: 'ARS',
      valuePrefix: '09',
    })
  })
})

describe('extractFilterWhereClause', () => {
  test('builds prefix condition', () => {
    expect(extractFilterWhereClause({ property: 'ARS', valuePrefix: '09' })).toBe("ARS LIKE '09%'")
  })

  test('builds exclude condition that keeps NULL values', () => {
    expect(
      extractFilterWhereClause({ property: 'BEM', excludeValues: ['gemeinschaftsfrei'] }),
    ).toBe("(BEM IS NULL OR TRIM(BEM) NOT IN ('gemeinschaftsfrei'))")
  })

  test('combines prefix and exclude conditions', () => {
    expect(
      extractFilterWhereClause({
        property: 'BEM',
        valuePrefix: 'V',
        excludeValues: ['a', "b'c"],
      }),
    ).toBe("BEM LIKE 'V%' AND (BEM IS NULL OR TRIM(BEM) NOT IN ('a', 'b''c'))")
  })
})
