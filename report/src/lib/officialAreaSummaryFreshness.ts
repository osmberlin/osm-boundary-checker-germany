/**
 * Area-report KPI row for official freshness. Contract: `docs/processing-and-analysis.md`
 * (“Source timestamp contract”).
 */
import { de } from '../i18n/de'
import type { SourceMetadataSide } from '../types/report'
import { isOlderThanDays } from './dataAge'
import { EM_DASH } from './formatDe'
import {
  formatFreshnessDisplayDe,
  formatIsoTimestampToDateOnlyDe,
} from './formatSourceDownloadedAt'
import { optionalSourceStatLines, sourceStatLines } from './reportFreshnessLines'
import { selectSourceDateForFreshness } from './sourceFreshnessSelection'

/** Age-of-verification threshold for the official-dataset rose KPI (not vendor reference-date age). */
export const OFFICIAL_VERIFICATION_STALE_DAYS = 14

export function officialAreaSummaryFreshness(side: SourceMetadataSide | null | undefined): {
  relativeLine: string
  absoluteLine: string
  detailLine: string | null
  isOld: boolean
} {
  const hasOfficial = side != null
  const verifiedRaw = side?.sourceUpdatedAtVerifiedAt?.trim()
  const choice = selectSourceDateForFreshness(side)
  const standRaw = choice.primaryRaw?.trim()
  const downloadedFresh = sourceStatLines(side?.downloadedAt, hasOfficial)

  if (verifiedRaw && standRaw) {
    const ver = formatFreshnessDisplayDe(verifiedRaw)
    return {
      relativeLine: ver.relativeLine ?? EM_DASH,
      absoluteLine: formatIsoTimestampToDateOnlyDe(standRaw),
      detailLine: `${de.areaReport.freshnessSecondaryDownloadedPrefix}: ${downloadedFresh.absoluteLine}`,
      isOld: isOlderThanDays(verifiedRaw, OFFICIAL_VERIFICATION_STALE_DAYS),
    }
  }

  const merged = optionalSourceStatLines(standRaw) ?? downloadedFresh
  const detailLine =
    choice.secondaryDownloadedRaw && hasOfficial
      ? `${de.areaReport.freshnessSecondaryDownloadedPrefix}: ${downloadedFresh.absoluteLine}`
      : null
  return {
    relativeLine: merged.relativeLine,
    absoluteLine: merged.absoluteLine,
    detailLine,
    isOld: false,
  }
}
