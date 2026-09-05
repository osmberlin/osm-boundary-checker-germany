import { describe, expect, test } from 'bun:test'
import { compareBoundariesCliArgs } from './compareBoundariesCliArgs.ts'

describe('compareBoundariesCliArgs', () => {
  test('includes --no-sync for nightly per-area compare', () => {
    expect(compareBoundariesCliArgs('de-berlin-bezirke')).toEqual([
      'scripts/compare/compare-boundaries.ts',
      '--area',
      'de-berlin-bezirke',
      '--no-sync',
    ])
  })
})
