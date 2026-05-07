/**
 * Area-report KPI row for official freshness. Contract: `docs/processing-and-analysis.md`
 * (“Source timestamp contract”).
 *
 * The KPI relative-age line and second-row absolute time both use the vendor **reference date**
 * (`sourceUpdatedAt`, else `sourcePublishedAt`) — same fields as the modal, not verification or
 * download timestamps. Rose highlighting (`isOld`) still follows metadata verification freshness
 * (`sourceUpdatedAtVerifiedAt`).
 */
import { de } from '../i18n/de'
import type { SourceMetadataSide } from '../types/report'
import { isOlderThanDays } from './dataAge'
import { pickOfficialDatasetExtractDate } from './datasetExtractDataDates'
import { kpiFreshnessLinesFromIso, sourceStatLines } from './reportFreshnessLines'
import { selectSourceDateForFreshness } from './sourceFreshnessSelection'

/** Age-of-verification threshold for the official-dataset rose KPI (not vendor reference-date age). */
export const OFFICIAL_VERIFICATION_STALE_DAYS = 14

export function officialAreaSummaryFreshness(side: SourceMetadataSide | null | undefined): {
  relativeLine: string
  /** Same as `pairedAbsoluteLine`; kept for callers that referenced the old field name. */
  absoluteLine: string
  /** Vendor reference instant; same anchor ISO as `relativeLine`. */
  pairedAbsoluteLine: string
  detailLine: string | null
  isOld: boolean
} {
  const hasOfficial = side != null
  const verifiedRaw = side?.sourceUpdatedAtVerifiedAt?.trim()
  const choice = selectSourceDateForFreshness(side)
  const standRaw = choice.primaryRaw?.trim()
  const downloadedFresh = sourceStatLines(side?.downloadedAt, hasOfficial)

  const referenceRaw = pickOfficialDatasetExtractDate(side).sourceDateRaw?.trim()
  const lines = kpiFreshnessLinesFromIso(referenceRaw)
  const relativeLine = lines.relativeLine
  const pairedAbsoluteLine = lines.absoluteLine

  const detailLine =
    verifiedRaw && standRaw
      ? `${de.areaReport.freshnessSecondaryDownloadedPrefix}: ${downloadedFresh.absoluteLine}`
      : choice.secondaryDownloadedRaw && hasOfficial
        ? `${de.areaReport.freshnessSecondaryDownloadedPrefix}: ${downloadedFresh.absoluteLine}`
        : null

  const isOld =
    verifiedRaw && standRaw ? isOlderThanDays(verifiedRaw, OFFICIAL_VERIFICATION_STALE_DAYS) : false

  return {
    relativeLine,
    absoluteLine: pairedAbsoluteLine,
    pairedAbsoluteLine,
    detailLine,
    isOld,
  }
}
