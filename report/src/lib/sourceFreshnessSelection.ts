import type { SourceMetadataSide } from '../types/report'

export type SourceDateSelection = {
  primaryRaw: string | undefined
  secondaryDownloadedRaw: string | undefined
}

function normalized(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim()
  return trimmed ? trimmed : undefined
}

/**
 * Primary timestamp for KPI copy = vendor data freshness (updated → published → geometry fetch only).
 * Caller should use `downloadedAt` separately for staleness coloring when it differs.
 */
export function selectSourceDateForFreshness(
  side: SourceMetadataSide | null | undefined,
): SourceDateSelection {
  const sourceUpdatedAt = normalized(side?.sourceUpdatedAt)
  const sourcePublishedAt = normalized(side?.sourcePublishedAt)
  const downloadedAt = normalized(side?.downloadedAt)
  if (sourceUpdatedAt) {
    return {
      primaryRaw: sourceUpdatedAt,
      secondaryDownloadedRaw: downloadedAt,
    }
  }
  if (sourcePublishedAt) {
    return {
      primaryRaw: sourcePublishedAt,
      secondaryDownloadedRaw: downloadedAt,
    }
  }
  return {
    primaryRaw: downloadedAt,
    secondaryDownloadedRaw: undefined,
  }
}
