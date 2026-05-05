import type { OsmSourceMetadataSide } from '../../../scripts/shared/sourceMetadata.ts'
import type { SourceMetadataSide } from '../types/report'

function normalized(raw: string | undefined): string | undefined {
  const t = raw?.trim()
  return t ? t : undefined
}

export type OfficialDatasetDatePick = {
  raw: string | undefined
  /** Only amtlicher Bezugszeitpunkt — no sourcePublishedAt / sourceUpdatedAt. */
  isPipelineFetchFallback: boolean
}

/**
 * Prefer vendor/source timestamps from capabilities or manual metadata; otherwise the
 * pipeline fetch time stored as `downloadedAt` (labeled separately in the UI).
 */
export function pickOfficialDatasetExtractDate(
  side: SourceMetadataSide | null | undefined,
): OfficialDatasetDatePick {
  const updated = normalized(side?.sourceUpdatedAt)
  const published = normalized(side?.sourcePublishedAt)
  const downloaded = normalized(side?.downloadedAt)
  if (updated) return { raw: updated, isPipelineFetchFallback: false }
  if (published) return { raw: published, isPipelineFetchFallback: false }
  return {
    raw: downloaded,
    isPipelineFetchFallback: downloaded !== undefined,
  }
}

export type OsmDatasetDatePick = {
  raw: string | undefined
  /** Set by `osm:extract` when `osmium fileinfo … header.option.timestamp` succeeds. */
  snapshotFromPbfHeader: boolean
}

export function pickOsmDatasetExtractDate(side: OsmSourceMetadataSide): OsmDatasetDatePick {
  return {
    raw: normalized(side.downloadedAt),
    snapshotFromPbfHeader: side.sourceDateSource === 'osm_pbf_header',
  }
}
