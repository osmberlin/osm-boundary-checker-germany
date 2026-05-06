import { describe, expect, it } from 'vitest'
import { selectSourceDateForFreshness } from './sourceFreshnessSelection'

describe('selectSourceDateForFreshness', () => {
  it('prefers sourceUpdatedAt when present', () => {
    expect(
      selectSourceDateForFreshness({
        sourceUpdatedAt: '2026-01-03T10:00:00Z',
        downloadedAt: '2026-01-05T12:00:00Z',
        sourcePublicUrl: 'https://example.test/source-page',
        sourceDownloadUrl: 'https://example.test/download',
      }),
    ).toEqual({
      primaryRaw: '2026-01-03T10:00:00Z',
      secondaryDownloadedRaw: '2026-01-05T12:00:00Z',
    })
  })

  it('prefers sourcePublishedAt when updated missing', () => {
    expect(
      selectSourceDateForFreshness({
        sourcePublishedAt: '2025-06-01T00:00:00Z',
        downloadedAt: '2026-01-05T12:00:00Z',
        sourcePublicUrl: 'https://example.test/source-page',
        sourceDownloadUrl: 'https://example.test/download',
      }),
    ).toEqual({
      primaryRaw: '2025-06-01T00:00:00Z',
      secondaryDownloadedRaw: '2026-01-05T12:00:00Z',
    })
  })

  it('falls back to downloadedAt and keeps no secondary line', () => {
    expect(
      selectSourceDateForFreshness({
        downloadedAt: '2026-01-05T12:00:00Z',
        sourcePublicUrl: 'https://example.test/source-page',
        sourceDownloadUrl: 'https://example.test/download',
      }),
    ).toEqual({
      primaryRaw: '2026-01-05T12:00:00Z',
      secondaryDownloadedRaw: undefined,
    })
  })

  it('returns empty selection when metadata is missing', () => {
    expect(selectSourceDateForFreshness(null)).toEqual({
      primaryRaw: undefined,
      secondaryDownloadedRaw: undefined,
    })
  })
})
