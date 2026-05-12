import { describe, expect, it } from 'vitest'
import { EM_DASH, formatDeInteger, formatDePercentPoints } from './formatDe'

describe('formatDeInteger', () => {
  it('formats thousands with dot separator', () => {
    expect(formatDeInteger(1234)).toBe('1.234')
  })
})

describe('EM_DASH', () => {
  it('is an em dash', () => {
    expect(EM_DASH).toBe('—')
  })
})

describe('formatDePercentPoints', () => {
  it('drops fractional digits when absolute value is greater than 10', () => {
    expect(formatDePercentPoints(22.21)).toBe('22\u00a0%')
    expect(formatDePercentPoints(10.1)).toBe('10\u00a0%')
  })

  it('formats exact zero without fractional digits', () => {
    expect(formatDePercentPoints(0)).toBe('0\u00a0%')
    expect(formatDePercentPoints(-0)).toBe('0\u00a0%')
  })

  it('keeps up to two decimals for ordinary values up to 10', () => {
    expect(formatDePercentPoints(10)).toBe('10\u00a0%')
    expect(formatDePercentPoints(9.25)).toBe('9,25\u00a0%')
    expect(formatDePercentPoints(0.005)).toBe('0,01\u00a0%')
  })

  it('uses up to three decimals only when two-decimal |n| still rounds to zero', () => {
    expect(formatDePercentPoints(0.002)).toBe('0,002\u00a0%')
    expect(formatDePercentPoints(-0.002)).toBe('-0,002\u00a0%')
  })
})
