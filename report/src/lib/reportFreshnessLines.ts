import { de } from '../i18n/de'
import { EM_DASH } from './formatDe'
import { formatFreshnessDisplayDe } from './formatSourceDownloadedAt'

/** Official / OSM download rows: same rules as the area summary stat block. */
export function sourceStatLines(
  raw: string | undefined,
  hasMetadata: boolean,
): { relativeLine: string; absoluteLine: string } {
  if (!hasMetadata) {
    return { relativeLine: EM_DASH, absoluteLine: EM_DASH }
  }
  const trimmed = raw?.trim()
  if (!trimmed) {
    return {
      relativeLine: EM_DASH,
      absoluteLine: de.areaReport.sourceDateUnknown,
    }
  }
  const f = formatFreshnessDisplayDe(trimmed)
  return {
    relativeLine: f.relativeLine ?? EM_DASH,
    absoluteLine: f.absoluteLine || EM_DASH,
  }
}
