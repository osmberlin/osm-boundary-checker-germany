import { describe, expect, it } from 'vitest'
import { normalizeDiscussMatchString } from '../../../scripts/shared/discussMatch.ts'

describe('normalizeDiscussMatchString', () => {
  it('trims and removes trailing slash except root', () => {
    expect(normalizeDiscussMatchString('  /a/b/  ')).toBe('/a/b')
    expect(normalizeDiscussMatchString('/')).toBe('/')
    expect(normalizeDiscussMatchString('/x/')).toBe('/x')
  })
})
