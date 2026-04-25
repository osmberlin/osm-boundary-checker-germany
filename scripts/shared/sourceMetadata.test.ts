import { describe, expect, test } from 'bun:test'
import { areaSourceMetadataFileSchema } from './sourceMetadata.ts'

describe('areaSourceMetadataFileSchema', () => {
  test('accepts payload with required source URLs', () => {
    const parsed = areaSourceMetadataFileSchema.parse({
      official: {
        downloadedAt: '2026-04-23T12:45:00.000Z',
        sourcePublicUrl: 'https://example.test/source-page',
        sourceDownloadUrl: 'https://example.test/download',
      },
    })
    expect(parsed.official?.downloadedAt).toBe('2026-04-23T12:45:00.000Z')
    expect(parsed.official?.sourceUpdatedAt).toBeUndefined()
  })

  test('normalizes empty strings to undefined', () => {
    const parsed = areaSourceMetadataFileSchema.parse({
      official: {
        downloadedAt: '  ',
        sourcePublishedAt: '2025-12-01',
        sourcePublicUrl: ' https://example.test/source-page ',
        sourceDownloadUrl: ' https://example.test/download ',
      },
    })
    expect(parsed.official?.downloadedAt).toBeUndefined()
    expect(parsed.official?.sourcePublishedAt).toBe('2025-12-01')
    expect(parsed.official?.sourcePublicUrl).toBe('https://example.test/source-page')
    expect(parsed.official?.sourceDownloadUrl).toBe('https://example.test/download')
  })

  test('fills explicit unknown defaults for licence fields', () => {
    const parsed = areaSourceMetadataFileSchema.parse({
      official: {
        downloadedAt: '2026-04-23T12:45:00.000Z',
        sourcePublicUrl: 'https://example.test/source-page',
        sourceDownloadUrl: 'https://example.test/download',
      },
    })
    expect(parsed.official?.licenseId).toBe('unknown')
    expect(parsed.official?.licenseLabel).toBe('unknown')
    expect(parsed.official?.osmCompatibility).toBe('unknown')
  })

  test('omits OSM compatibility fields for osm metadata side', () => {
    const parsed = areaSourceMetadataFileSchema.parse({
      osm: {
        sourcePublicUrl: 'https://example.test/source-page',
        sourceDownloadUrl: 'https://example.test/download',
        osmCompatibility: 'yes_licence',
      },
    } as unknown)
    expect(parsed.osm?.sourcePublicUrl).toBe('https://example.test/source-page')
    expect(parsed.osm).not.toHaveProperty('osmCompatibility')
  })

  test('rejects unknown sourceDateSource values', () => {
    expect(() =>
      areaSourceMetadataFileSchema.parse({
        official: {
          sourcePublicUrl: 'https://example.test/source-page',
          sourceDownloadUrl: 'https://example.test/download',
          sourceDateSource: 'legacy',
        },
      }),
    ).toThrow()
  })

  test('rejects missing required source URLs', () => {
    expect(() =>
      areaSourceMetadataFileSchema.parse({
        official: {
          downloadedAt: '2026-04-23T12:45:00.000Z',
        },
      }),
    ).toThrow()
  })
})
