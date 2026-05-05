import { describe, expect, it } from 'vitest'
import type { OsmSourceMetadataSide } from '../../../scripts/shared/sourceMetadata.ts'
import type { SourceMetadataSide } from '../types/report'
import {
  pickOfficialDatasetExtractDate,
  pickOsmDatasetExtractDate,
} from './datasetExtractDataDates'

describe('pickOfficialDatasetExtractDate', () => {
  it('prefers sourceUpdatedAt over published and downloaded', () => {
    const side = {
      sourceUpdatedAt: '2026-01-03T10:00:00Z',
      sourcePublishedAt: '2020-01-01T00:00:00Z',
      downloadedAt: '2026-05-01T12:00:00Z',
    } satisfies Partial<SourceMetadataSide> as SourceMetadataSide
    expect(pickOfficialDatasetExtractDate(side)).toEqual({
      raw: '2026-01-03T10:00:00Z',
      isPipelineFetchFallback: false,
    })
  })

  it('uses sourcePublishedAt when updated missing', () => {
    const side = {
      sourcePublishedAt: '2020-01-01T00:00:00Z',
      downloadedAt: '2026-05-01T12:00:00Z',
    } satisfies Partial<SourceMetadataSide> as SourceMetadataSide
    expect(pickOfficialDatasetExtractDate(side)).toEqual({
      raw: '2020-01-01T00:00:00Z',
      isPipelineFetchFallback: false,
    })
  })

  it('falls back to downloadedAt with pipeline flag', () => {
    const side = {
      downloadedAt: '2026-05-01T12:00:00Z',
    } satisfies Partial<SourceMetadataSide> as SourceMetadataSide
    expect(pickOfficialDatasetExtractDate(side)).toEqual({
      raw: '2026-05-01T12:00:00Z',
      isPipelineFetchFallback: true,
    })
  })
})

describe('pickOsmDatasetExtractDate', () => {
  it('marks PBF header snapshot', () => {
    const side = {
      downloadedAt: '2026-04-21T20:20:22Z',
      sourceDateSource: 'osm_pbf_header',
    } satisfies Partial<OsmSourceMetadataSide> as OsmSourceMetadataSide
    expect(pickOsmDatasetExtractDate(side)).toEqual({
      raw: '2026-04-21T20:20:22Z',
      snapshotFromPbfHeader: true,
    })
  })

  it('treats missing source marker as uncertain', () => {
    const side = {
      downloadedAt: '2026-04-21T20:20:22Z',
    } satisfies Partial<OsmSourceMetadataSide> as OsmSourceMetadataSide
    expect(pickOsmDatasetExtractDate(side)).toEqual({
      raw: '2026-04-21T20:20:22Z',
      snapshotFromPbfHeader: false,
    })
  })
})
