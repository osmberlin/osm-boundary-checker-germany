import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns'
import { de as deLocale } from 'date-fns/locale'

/** Absolute line for report freshness, e.g. "29. März 2026 13:13". */
export function formatReportAbsoluteDe(d: Date): string {
  return format(d, 'd. MMMM yyyy HH:mm', { locale: deLocale })
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
  const d = parseISO(trimmed)
  if (!isValid(d)) {
    return { absoluteLine: trimmed, relativeLine: null }
  }
  return {
    absoluteLine: formatReportAbsoluteDe(d),
    relativeLine: formatRelativeAgeAltDe(d),
  }
}
