import { describe, expect, test } from 'bun:test'
import { areaSourceMetadataFileSchema } from './sourceMetadata.ts'

describe('areaSourceMetadataFileSchema', () => {
  test('accepts legacy payload with downloadedAt only', () => {
    const parsed = areaSourceMetadataFileSchema.parse({
      official: { downloadedAt: '2026-04-23T12:45:00.000Z' },
    })
    expect(parsed.official?.downloadedAt).toBe('2026-04-23T12:45:00.000Z')
    expect(parsed.official?.sourceUpdatedAt).toBeUndefined()
  })

  test('normalizes empty strings to undefined', () => {
    const parsed = areaSourceMetadataFileSchema.parse({
      official: {
        downloadedAt: '  ',
        sourcePublishedAt: '2025-12-01',
      },
    })
    expect(parsed.official?.downloadedAt).toBeUndefined()
    expect(parsed.official?.sourcePublishedAt).toBe('2025-12-01')
  })

  test('rejects unknown sourceDateSource values', () => {
    expect(() =>
      areaSourceMetadataFileSchema.parse({
        official: {
          sourceDateSource: 'legacy',
        },
      }),
    ).toThrow()
  })
})
