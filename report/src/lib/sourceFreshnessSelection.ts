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
 * Prioritize source-updated date for relevance, but keep downloaded date as
 * secondary context when both are available.
 */
export function selectSourceDateForFreshness(
  side: SourceMetadataSide | null | undefined,
): SourceDateSelection {
  const sourceUpdatedAt = normalized(side?.sourceUpdatedAt)
  const downloadedAt = normalized(side?.downloadedAt)
  if (sourceUpdatedAt) {
    return {
      primaryRaw: sourceUpdatedAt,
      secondaryDownloadedRaw: downloadedAt,
    }
  }
  return {
    primaryRaw: downloadedAt,
    secondaryDownloadedRaw: undefined,
  }
}
