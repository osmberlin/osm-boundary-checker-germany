import { describe, expect, it } from 'vitest'
import type { OsmSourceMetadataSide } from '../../../scripts/shared/sourceMetadata.ts'
import type { SourceMetadataSide } from '../types/report'
import {
  pickOfficialDatasetExtractDate,
  pickOsmDatasetExtractDate,
} from './datasetExtractDataDates'

describe('pickOfficialDatasetExtractDate', () => {
  it('splits vendor stand, verification, and geometry fetch timestamps', () => {
    const side = {
      sourceUpdatedAt: '2026-01-03T10:00:00Z',
      sourcePublishedAt: '2020-01-01T00:00:00Z',
      sourceUpdatedAtVerifiedAt: '2026-05-06T08:00:00Z',
      downloadedAt: '2026-05-01T12:00:00Z',
    } satisfies Partial<SourceMetadataSide> as SourceMetadataSide
    expect(pickOfficialDatasetExtractDate(side)).toEqual({
      sourceDateRaw: '2026-01-03T10:00:00Z',
      checkedAtRaw: '2026-05-06T08:00:00Z',
      geometryFetchedAtRaw: '2026-05-01T12:00:00Z',
    })
  })

  it('uses sourcePublishedAt when updated missing', () => {
    const side = {
      sourcePublishedAt: '2020-01-01T00:00:00Z',
      sourceUpdatedAtVerifiedAt: '2026-05-06T08:00:00Z',
      downloadedAt: '2026-05-01T12:00:00Z',
    } satisfies Partial<SourceMetadataSide> as SourceMetadataSide
    expect(pickOfficialDatasetExtractDate(side)).toEqual({
      sourceDateRaw: '2020-01-01T00:00:00Z',
      checkedAtRaw: '2026-05-06T08:00:00Z',
      geometryFetchedAtRaw: '2026-05-01T12:00:00Z',
    })
  })

  it('missing vendor stand leaves source row unknown while geometry fetch may exist', () => {
    const side = {
      downloadedAt: '2026-05-01T12:00:00Z',
      sourceUpdatedAtVerifiedAt: '2026-05-06T08:00:00Z',
    } satisfies Partial<SourceMetadataSide> as SourceMetadataSide
    expect(pickOfficialDatasetExtractDate(side)).toEqual({
      sourceDateRaw: undefined,
      checkedAtRaw: '2026-05-06T08:00:00Z',
      geometryFetchedAtRaw: '2026-05-01T12:00:00Z',
    })
  })

  it('returns empty pick when side missing', () => {
    expect(pickOfficialDatasetExtractDate(undefined)).toEqual({
      sourceDateRaw: undefined,
      checkedAtRaw: undefined,
      geometryFetchedAtRaw: undefined,
    })
  })
})

describe('pickOsmDatasetExtractDate', () => {
  it('marks PBF header snapshot on source row; check uses extractedAt when set', () => {
    const side = {
      downloadedAt: '2026-04-21T20:20:22Z',
      extractedAt: '2026-05-06T10:30:00.000Z',
      sourceDateSource: 'osm_pbf_header',
    } satisfies Partial<OsmSourceMetadataSide> as OsmSourceMetadataSide
    expect(pickOsmDatasetExtractDate(side)).toEqual({
      sourceDateRaw: '2026-04-21T20:20:22Z',
      checkedAtRaw: '2026-05-06T10:30:00.000Z',
      snapshotFromPbfHeader: true,
    })
  })

  it('falls back check to downloadedAt when extractedAt missing under PBF header', () => {
    const side = {
      downloadedAt: '2026-04-21T20:20:22Z',
      sourceDateSource: 'osm_pbf_header',
    } satisfies Partial<OsmSourceMetadataSide> as OsmSourceMetadataSide
    expect(pickOsmDatasetExtractDate(side)).toEqual({
      sourceDateRaw: '2026-04-21T20:20:22Z',
      checkedAtRaw: '2026-04-21T20:20:22Z',
      snapshotFromPbfHeader: true,
    })
  })

  it('treats missing source marker as uncertain for source row only', () => {
    const side = {
      downloadedAt: '2026-04-21T20:20:22Z',
    } satisfies Partial<OsmSourceMetadataSide> as OsmSourceMetadataSide
    expect(pickOsmDatasetExtractDate(side)).toEqual({
      sourceDateRaw: undefined,
      checkedAtRaw: '2026-04-21T20:20:22Z',
      snapshotFromPbfHeader: false,
    })
  })
})
