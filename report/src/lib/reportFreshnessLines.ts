import { de } from '../i18n/de'
import { EM_DASH } from './formatDe'
import { formatFreshnessDisplayDe } from './formatSourceDownloadedAt'

/**
 * One ISO timestamp → KPI relative-age line + absolute datetime below (same instant).
 * Use for all freshness stat columns so relative age always matches the shown clock time.
 */
export function kpiFreshnessLinesFromIso(isoRaw: string | undefined | null): {
  relativeLine: string
  absoluteLine: string
} {
  const trimmed = isoRaw?.trim()
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

/** Optional line: returns null when no usable source date is available. */
export function optionalSourceStatLines(
  raw: string | undefined,
): { relativeLine: string; absoluteLine: string } | null {
  const trimmed = raw?.trim()
  if (!trimmed) return null
  const f = formatFreshnessDisplayDe(trimmed)
  return {
    relativeLine: f.relativeLine ?? EM_DASH,
    absoluteLine: f.absoluteLine || EM_DASH,
  }
}
