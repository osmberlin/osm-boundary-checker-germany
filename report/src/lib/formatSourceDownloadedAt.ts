import type { TZDate } from '@date-fns/tz'
import {
  differenceInHours,
  differenceInMonths,
  differenceInYears,
  format,
  formatDistanceToNow,
} from 'date-fns'
import { de as deLocale } from 'date-fns/locale/de'
import { berlinCalendarDateKey, berlinDateKeyToTZDate } from './time/calendar'
import { berlinNow, parseIsoToBerlin } from './time/parse'

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

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/

/** Calendar date only (no time), e.g. "29. März 2026". */
export function formatReportDateOnlyDe(at: TZDate): string {
  return format(at, 'd. MMMM yyyy', { locale: deLocale })
}

/** Absolute line for report freshness, e.g. "29. März 2026 13:13". */
export function formatReportAbsoluteDe(at: TZDate): string {
  return format(at, 'd. MMM yyyy HH:mm', { locale: deLocale })
}

/** ISO or `YYYY-MM-DD` → Berlin `TZDate` for display formatters. */
export function parseReportTimestampToBerlin(raw: string): TZDate | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (DATE_ONLY_RE.test(trimmed)) {
    return berlinDateKeyToTZDate(trimmed, 12, 0, 0)
  }
  return parseIsoToBerlin(trimmed)
}

function parseReportTimestampOrThrow(raw: string): TZDate {
  const berlin = parseReportTimestampToBerlin(raw)
  if (!berlin) {
    throw new Error(`Invalid ISO timestamp in report payload: ${raw}`)
  }
  return berlin
}

/** ISO timestamp → German calendar date (Europe/Berlin). */
export function formatIsoTimestampToDateOnlyDe(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  return formatReportDateOnlyDe(parseReportTimestampOrThrow(trimmed))
}

/** ISO timestamp → German date + time in Europe/Berlin. */
export function formatIsoTimestampToAbsoluteDe(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  return formatReportAbsoluteDe(parseReportTimestampOrThrow(trimmed))
}

/**
 * Relative age for KPI rows, e.g. "4 Stunden alt" (no leading "etwa").
 * Instants are compared in Europe/Berlin wall time.
 */
export function formatRelativeAgeAltDe(at: TZDate): string {
  const now = berlinNow()
  if (at.getTime() > now.getTime()) {
    let s = formatDistanceToNow(at, { locale: deLocale, addSuffix: false })
    s = s.replace(/^etwa\s+/i, '').trim()
    return `${s} alt`
  }

  const fullHours = differenceInHours(now, at)
  if (fullHours >= 1 && fullHours < HOUR_DAY_THRESHOLD) {
    return `${fullHours} ${fullHours === 1 ? 'Stunde' : 'Stunden'} alt`
  }

  const fullMonths = differenceInMonths(now, at)
  if (fullMonths > MONTH_YEAR_THRESHOLD) {
    const fullYears = differenceInYears(now, at)
    return `${fullYears} ${fullYears === 1 ? 'Jahr' : 'Jahre'} alt`
  }
  if (fullMonths >= 12) {
    return `${fullMonths} Monate alt`
  }

  let s = formatDistanceToNow(at, { locale: deLocale, addSuffix: false })
  s = s.replace(/^etwa\s+/i, '').trim()
  return `${s} alt`
}

export function formatFreshnessDisplayDe(raw: string): {
  absoluteLine: string
  relativeLine: string | null
} {
  const trimmed = raw.trim()
  if (!trimmed) {
    return { absoluteLine: '', relativeLine: null }
  }
  const at = parseReportTimestampOrThrow(trimmed)
  return {
    absoluteLine: formatReportAbsoluteDe(at),
    relativeLine: formatRelativeAgeAltDe(at),
  }
}

/** Compact absolute line for tooltips (status timeline, etc.). */
export function formatIsoTimestampTooltipDe(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  const at = parseIsoToBerlin(trimmed)
  if (!at) return trimmed
  return format(at, 'PPp', { locale: deLocale })
}

/** German calendar label for date-only or ISO snapshot strings. */
export function formatSnapshotDateLabelDe(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  if (DATE_ONLY_RE.test(trimmed)) {
    const at = berlinDateKeyToTZDate(trimmed)
    return at ? format(at, 'P', { locale: deLocale }) : trimmed
  }
  const key = berlinCalendarDateKey(trimmed)
  if (!key) return trimmed
  const at = berlinDateKeyToTZDate(key)
  return at ? format(at, 'P', { locale: deLocale }) : trimmed
}
