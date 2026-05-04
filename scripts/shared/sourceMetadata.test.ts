import { describe, expect, test } from 'bun:test'
import { buildResolvedOsmSourceSide } from './osmGermanyProvenance.ts'
import { areaSourceMetadataFileSchema, buildComparisonSourceMetadata } from './sourceMetadata.ts'

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

  test('parses slim osm side (only persisted timestamps)', () => {
    const parsed = areaSourceMetadataFileSchema.parse({
      osm: {
        downloadedAt: '2026-04-21T20:20:22Z',
        sourceDateSource: 'osm_pbf_header',
      },
    })
    expect(parsed.osm?.downloadedAt).toBe('2026-04-21T20:20:22Z')
    expect(parsed.osm?.sourceDateSource).toBe('osm_pbf_header')
  })

  test('buildResolvedOsmSourceSide merges Geofabrik defaults with persisted timestamps', () => {
    const full = buildResolvedOsmSourceSide({
      downloadedAt: '2026-04-21T20:20:22Z',
      sourceDateSource: 'osm_pbf_header',
    })
    expect(full.sourceDownloadUrl).toContain('geofabrik')
    expect(full.downloadedAt).toBe('2026-04-21T20:20:22Z')
    expect(full.licenseLabel).toBe('ODbL-1.0')
  })

  test('buildComparisonSourceMetadata requires official only', () => {
    const meta = buildComparisonSourceMetadata({
      official: {
        downloadedAt: '2026-01-01T00:00:00.000Z',
        sourcePublicUrl: 'https://example.test/page',
        sourceDownloadUrl: 'https://example.test/dl',
      },
      osm: { downloadedAt: '2026-04-21T20:20:22Z' },
    })
    expect(meta.official.downloadedAt).toBe('2026-01-01T00:00:00.000Z')
    expect(meta.osm.downloadedAt).toBe('2026-04-21T20:20:22Z')
    expect(meta.osm).not.toHaveProperty('sourcePublicUrl')
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
