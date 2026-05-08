import {
  differenceInHours,
  differenceInMonths,
  differenceInYears,
  format,
  formatDistanceToNow,
  isValid,
  parseISO,
} from 'date-fns'
import { de as deLocale } from 'date-fns/locale'

/**
 * Below this many full hours we render the age in hours rather than days.
 * `formatDistanceToNow` flips to "1 Tag" already at 22h which obscures
 * sub-day freshness in KPI rows; keep hour granularity until a full extra
 * day has clearly passed.
 */
const HOUR_DAY_THRESHOLD = 26

/**
 * Above this many full months we switch from "X Monate alt" to year counts
 * so labels do not grow into nonsensical values like "138 Monate alt".
 */
const MONTH_YEAR_THRESHOLD = 13

/** Calendar date only (no time), e.g. "29. März 2026". */
export function formatReportDateOnlyDe(d: Date): string {
  return format(d, 'd. MMMM yyyy', { locale: deLocale })
}

/** Absolute line for report freshness, e.g. "29. März 2026 13:13". */
export function formatReportAbsoluteDe(d: Date): string {
  return format(d, 'd. MMM yyyy HH:mm', { locale: deLocale })
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

/**
 * Relative age for KPI rows, e.g. "4 Stunden alt" (no leading "etwa").
 * Below `HOUR_DAY_THRESHOLD` full hours we always show hours so a ~1-day-old
 * report does not collapse to "1 Tag alt". From 12 up to `MONTH_YEAR_THRESHOLD`
 * full months we render month counts ("13 Monate alt"); beyond that we switch
 * to year counts so labels stay short and never use year-based phrases from
 * `formatDistanceToNow` ("mehr als 1 Jahr …").
 */
export function formatRelativeAgeAltDe(d: Date): string {
  const now = new Date()
  if (d.getTime() > now.getTime()) {
    let s = formatDistanceToNow(d, { locale: deLocale, addSuffix: false })
    s = s.replace(/^etwa\s+/i, '').trim()
    return `${s} alt`
  }

  const fullHours = differenceInHours(now, d)
  if (fullHours >= 1 && fullHours < HOUR_DAY_THRESHOLD) {
    return `${fullHours} ${fullHours === 1 ? 'Stunde' : 'Stunden'} alt`
  }

  const fullMonths = differenceInMonths(now, d)
  if (fullMonths > MONTH_YEAR_THRESHOLD) {
    const fullYears = differenceInYears(now, d)
    return `${fullYears} ${fullYears === 1 ? 'Jahr' : 'Jahre'} alt`
  }
  if (fullMonths >= 12) {
    return `${fullMonths} Monate alt`
  }

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
