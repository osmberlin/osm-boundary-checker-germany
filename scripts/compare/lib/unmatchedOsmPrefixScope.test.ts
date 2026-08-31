import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  keepUnmatchedOsmForOfficialPrefix,
  resolveArsExtractPrefix,
} from './unmatchedOsmPrefixScope.ts'

const workspaceRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

describe('resolveArsExtractPrefix', () => {
  test('returns prefix for admin_rs + ARS extractFilter', () => {
    expect(resolveArsExtractPrefix({ property: 'ARS', valuePrefix: '09' }, true)).toBe('09')
  })

  test('accepts lowercase ars', () => {
    expect(resolveArsExtractPrefix({ property: 'ars', valuePrefix: '08' }, true)).toBe('08')
  })

  test('returns null outside RS mode', () => {
    expect(resolveArsExtractPrefix({ property: 'ARS', valuePrefix: '09' }, false)).toBeNull()
  })

  test('returns null for non-ARS property', () => {
    expect(resolveArsExtractPrefix({ property: 'name', valuePrefix: '09' }, true)).toBeNull()
  })

  test('returns null when prefix is blank', () => {
    expect(resolveArsExtractPrefix({ property: 'ARS', valuePrefix: '  ' }, true)).toBeNull()
  })

  test('returns null when extractFilter is missing', () => {
    expect(resolveArsExtractPrefix(undefined, true)).toBeNull()
  })
})

describe('keepUnmatchedOsmForOfficialPrefix', () => {
  test('drops Riesbürg (08…) from Bavaria (09) OSM-only', () => {
    expect(keepUnmatchedOsmForOfficialPrefix('081365002087', '09')).toBe(false)
  })

  test('keeps a Bavarian OSM-only key', () => {
    expect(keepUnmatchedOsmForOfficialPrefix('091715116116', '09')).toBe(true)
  })

  test('keeps Werbach (08…) out of Bavaria unmatched', () => {
    expect(keepUnmatchedOsmForOfficialPrefix('081285004128', '09')).toBe(false)
  })

  test('keeps short or empty keys as mapping errors', () => {
    expect(keepUnmatchedOsmForOfficialPrefix('', '09')).toBe(true)
    expect(keepUnmatchedOsmForOfficialPrefix('0', '09')).toBe(true)
  })

  test('no-op when prefix filter does not apply', () => {
    expect(keepUnmatchedOsmForOfficialPrefix('081365002087', null)).toBe(true)
  })
})

describe('de-gemeinden-by config', () => {
  test('scopes unmatched OSM to ARS 09 and has no Werbach ignoreRelationIds', () => {
    const path = join(workspaceRoot, 'datasets/de-gemeinden-by/config.jsonc')
    const raw = Bun.JSONC.parse(readFileSync(path, 'utf-8')) as {
      official?: { extractFilter?: { property?: string; valuePrefix?: string } }
      osm?: { ignoreRelationIds?: string[] }
    }
    const prefix = resolveArsExtractPrefix(
      {
        property: raw.official?.extractFilter?.property ?? '',
        valuePrefix: raw.official?.extractFilter?.valuePrefix ?? '',
      },
      true,
    )
    expect(prefix).toBe('09')
    expect(keepUnmatchedOsmForOfficialPrefix('081365002087', prefix)).toBe(false)
    expect(keepUnmatchedOsmForOfficialPrefix('081285004128', prefix)).toBe(false)
    expect(raw.osm?.ignoreRelationIds).toBeUndefined()
  })
})
