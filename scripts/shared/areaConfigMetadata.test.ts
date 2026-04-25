import { describe, expect, test } from 'bun:test'
import { parseAreaDisplayName, parseAreaOfficialSourceFacts } from './areaConfigMetadata.ts'

describe('parseAreaOfficialSourceFacts', () => {
  test('returns null when missing', () => {
    expect(parseAreaOfficialSourceFacts('area-x', {})).toBeNull()
  })

  test('parses official source', () => {
    const parsed = parseAreaOfficialSourceFacts('area-x', {
      official: {
        source: {
          sourcePublicUrl: ' https://example.test/info ',
          licenseLabel: 'DL-DE-BY-2.0',
        },
      },
    })
    expect(parsed?.sourcePublicUrl).toBe('https://example.test/info')
    expect(parsed?.licenseLabel).toBe('DL-DE-BY-2.0')
  })

  test('rejects unknown keys', () => {
    expect(() =>
      parseAreaOfficialSourceFacts('area-x', {
        official: {
          source: {
            sourceUrl: 'https://legacy.example',
          },
        },
      }),
    ).toThrow(/official.source/)
  })
})

describe('parseAreaDisplayName', () => {
  test('returns trimmed displayName', () => {
    expect(parseAreaDisplayName('area-x', { displayName: ' Berlin Bezirke ' })).toBe(
      'Berlin Bezirke',
    )
  })

  test('throws when missing', () => {
    expect(() => parseAreaDisplayName('area-x', {})).toThrow(/displayName/)
  })
})
