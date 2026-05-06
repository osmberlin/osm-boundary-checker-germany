import { describe, expect, test } from 'bun:test'
import { bkgDownloadMetadataSchema } from './bkgDownloadMetadata.ts'

describe('bkgDownloadMetadataSchema', () => {
  test('requires canonical downloadedAt key', () => {
    expect(() =>
      bkgDownloadMetadataSchema.parse({
        sourceUpdatedAt: '2026-01-01T00:00:00.000Z',
        sourceUpdatedAtVerifiedAt: '2026-01-02T00:00:00.000Z',
        sourceUrl: 'https://example.test/file.zip',
        zipRelativePath: '.cache/bkg/file.zip',
        gpkgRelativePath: '.cache/bkg/file.gpkg',
      }),
    ).toThrow()
  })

  test('rejects legacy zipLastFetchedAt-only payloads', () => {
    expect(() =>
      bkgDownloadMetadataSchema.parse({
        sourceUpdatedAt: '2026-01-01T00:00:00.000Z',
        sourceUpdatedAtVerifiedAt: '2026-01-02T00:00:00.000Z',
        zipLastFetchedAt: '2026-01-03T00:00:00.000Z',
        sourceUrl: 'https://example.test/file.zip',
        zipRelativePath: '.cache/bkg/file.zip',
        gpkgRelativePath: '.cache/bkg/file.gpkg',
      }),
    ).toThrow()
  })
})
