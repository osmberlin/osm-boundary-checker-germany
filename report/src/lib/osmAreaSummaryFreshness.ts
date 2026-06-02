import type { OsmSourceMetadataPersisted } from '../../../scripts/shared/sourceMetadata.ts'
import { de } from '../i18n/de'
import { isOlderThanDays } from './dataAge'
import { pickOsmDatasetExtractDate } from './datasetExtractDataDates'
import { kpiFreshnessLinesFromIso, sourceStatLines } from './reportFreshnessLines'

/** Planet snapshot age for the OSM KPI; secondary line shows extract wall-clock when it differs. */
export function osmAreaSummaryFreshness(side: OsmSourceMetadataPersisted | null | undefined): {
  relativeLine: string
  absoluteLine: string
  detailLine: string | null
  isOld: boolean
} {
  const hasOsm = side != null
  const pick = pickOsmDatasetExtractDate(side ?? {})
  const snapshotRaw = pick.sourceDateRaw?.trim()
  const processedRaw = pick.checkedAtRaw?.trim()
  const snapshotLines = kpiFreshnessLinesFromIso(snapshotRaw)
  const processedLines = sourceStatLines(processedRaw, hasOsm)

  const detailLine =
    pick.snapshotFromPbfHeader && processedRaw && snapshotRaw && processedRaw !== snapshotRaw
      ? `${de.areaReport.freshnessSecondaryExtractedPrefix}: ${processedLines.absoluteLine}`
      : null

  return {
    relativeLine: snapshotLines.relativeLine ?? de.areaReport.sourceDateUnknown,
    absoluteLine: snapshotLines.absoluteLine || de.areaReport.sourceDateUnknown,
    detailLine,
    isOld: snapshotRaw ? isOlderThanDays(snapshotRaw, 5) : false,
  }
}
