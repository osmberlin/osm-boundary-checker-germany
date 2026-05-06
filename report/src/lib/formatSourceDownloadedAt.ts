import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns'
import { de as deLocale } from 'date-fns/locale'

/** Calendar date only (no time), e.g. "29. März 2026". */
export function formatReportDateOnlyDe(d: Date): string {
  return format(d, 'd. MMMM yyyy', { locale: deLocale })
}

/** Absolute line for report freshness, e.g. "29. März 2026 13:13". */
export function formatReportAbsoluteDe(d: Date): string {
  return format(d, 'd. MMMM yyyy HH:mm', { locale: deLocale })
}

function parseIsoOrThrow(raw: string): Date {
  const d = parseISO(raw)
  if (!isValid(d)) {
    throw new Error(`Invalid ISO timestamp in report payload: ${raw}`)
  }
  return d
}

/** ISO timestamp → German calendar date. */
export function formatIsoTimestampToDateOnlyDe(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  const d = parseIsoOrThrow(trimmed)
  return formatReportDateOnlyDe(d)
}

/** ISO timestamp → German date + time (same pattern as KPI freshness rows). */
export function formatIsoTimestampToAbsoluteDe(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  const d = parseIsoOrThrow(trimmed)
  return formatReportAbsoluteDe(d)
}

/** Relative age, e.g. "4 Stunden alt" (no "vor etwa"). */
export function formatRelativeAgeAltDe(d: Date): string {
  let s = formatDistanceToNow(d, { locale: deLocale, addSuffix: false })
  s = s.replace(/^etwa\s+/i, '').trim()
  return `${s} alt`
}

/**
 * Parses ISO (or other) timestamps from compare metadata for the area report
 * freshness rows: absolute line + "… alt" relative line.
 */
export function formatFreshnessDisplayDe(raw: string): {
  absoluteLine: string
  relativeLine: string | null
} {
  const trimmed = raw.trim()
  if (!trimmed) {
    return { absoluteLine: '', relativeLine: null }
  }
  const d = parseIsoOrThrow(trimmed)
  return {
    absoluteLine: formatReportAbsoluteDe(d),
    relativeLine: formatRelativeAgeAltDe(d),
  }
}
