import { describe, expect, it } from 'vitest'
import {
  compareDiscussPath,
  discussMatchPaths,
  normalizeDiscussMatchString,
} from '../../../scripts/shared/discussMatch.ts'

describe('discussMatchPaths', () => {
  it('returns the title alone for a normal page', () => {
    expect(discussMatchPaths(' /de-landkreise/feature/16070/ ')).toEqual([
      '/de-landkreise/feature/16070',
    ])
  })

  it('adds both detail pages for a compare page', () => {
    expect(discussMatchPaths(compareDiscussPath('vg', '160700028000', '160700028028'))).toEqual([
      '/vg/compare/160700028000/160700028028',
      '/vg/feature/160700028000',
      '/vg/feature/160700028028',
    ])
  })

  it('keeps keys decoded, like the router pathname', () => {
    expect(discussMatchPaths('/bo/compare/falkenhagener feld/x')).toContain(
      '/bo/feature/falkenhagener feld',
    )
  })

  it('keeps a base path prefix', () => {
    expect(discussMatchPaths('/base/vg/compare/a/b/')).toEqual([
      '/base/vg/compare/a/b',
      '/base/vg/feature/a',
      '/base/vg/feature/b',
    ])
  })
})

describe('normalizeDiscussMatchString', () => {
  it('trims and removes trailing slash except root', () => {
    expect(normalizeDiscussMatchString('  /a/b/  ')).toBe('/a/b')
    expect(normalizeDiscussMatchString('/')).toBe('/')
    expect(normalizeDiscussMatchString('/x/')).toBe('/x')
  })
})
