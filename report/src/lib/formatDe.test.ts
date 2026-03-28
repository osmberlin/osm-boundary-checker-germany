import { describe, expect, it } from 'vitest'
import { EM_DASH, formatDeInteger } from './formatDe'

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
