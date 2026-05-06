import type { OsmSourceMetadataSide } from '../../../scripts/shared/sourceMetadata.ts'
import type { SourceMetadataSide } from '../types/report'

function normalized(raw: string | undefined): string | undefined {
  const t = raw?.trim()
  return t ? t : undefined
}

export type OfficialDatasetDatePick = {
  /** Vendor reference date (`sourceUpdatedAt`, else `sourcePublishedAt`). */
  sourceDateRaw: string | undefined
  /** `sourceUpdatedAtVerifiedAt` — upstream metadata successfully re-checked. */
  checkedAtRaw: string | undefined
  /** Last geometry fetch (`official.downloadedAt`). */
  geometryFetchedAtRaw: string | undefined
}

/**
 * Feature-detail caption fields for official provenance.
 * See `docs/processing-and-analysis.md` (“Source timestamp contract”).
 */
export function pickOfficialDatasetExtractDate(
  side: SourceMetadataSide | null | undefined,
): OfficialDatasetDatePick {
  if (!side) {
    return {
      sourceDateRaw: undefined,
      checkedAtRaw: undefined,
      geometryFetchedAtRaw: undefined,
    }
  }
  const updated = normalized(side.sourceUpdatedAt)
  const published = normalized(side.sourcePublishedAt)
  const verified = normalized(side.sourceUpdatedAtVerifiedAt)
  const downloaded = normalized(side.downloadedAt)
  return {
    sourceDateRaw: updated ?? published,
    checkedAtRaw: verified,
    geometryFetchedAtRaw: downloaded,
  }
}

export type OsmDatasetDatePick = {
  /** Planet snapshot when `sourceDateSource === osm_pbf_header` (`downloadedAt` from PBF header). */
  sourceDateRaw: string | undefined
  /** Extract wall-clock (`extractedAt` when PBF header path; otherwise `downloadedAt`). */
  checkedAtRaw: string | undefined
  snapshotFromPbfHeader: boolean
}

export function pickOsmDatasetExtractDate(side: OsmSourceMetadataSide): OsmDatasetDatePick {
  const raw = normalized(side.downloadedAt)
  const fromHeader = side.sourceDateSource === 'osm_pbf_header'
  const extracted = normalized(side.extractedAt)
  return {
    sourceDateRaw: fromHeader ? raw : undefined,
    checkedAtRaw: fromHeader ? (extracted ?? raw) : raw,
    snapshotFromPbfHeader: fromHeader,
  }
}
