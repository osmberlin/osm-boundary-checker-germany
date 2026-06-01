import { TZDate } from '@date-fns/tz'
import { addDays, format, isValid } from 'date-fns'
import { BERLIN_TIME_ZONE } from './constants'
import { parseInstantInTimeZone } from './parse'

const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/** Calendar date in `timeZone` as `YYYY-MM-DD`. */
export function calendarDateKeyInTimeZone(iso: string, timeZone: string): string {
  const zoned = parseInstantInTimeZone(iso, timeZone)
  if (!zoned) return ''
  return format(zoned, 'yyyy-MM-dd')
}

/** Calendar date in Europe/Berlin as `YYYY-MM-DD`. */
export function berlinCalendarDateKey(iso: string): string {
  return calendarDateKeyInTimeZone(iso, BERLIN_TIME_ZONE)
}

/** Today’s calendar date in Europe/Berlin as `YYYY-MM-DD`. */
export function berlinTodayDateKey(now: Date = new Date()): string {
  return format(new TZDate(now.getTime(), BERLIN_TIME_ZONE), 'yyyy-MM-dd')
}

/**
 * Wall-clock instant on a calendar day in `timeZone`.
 * @param hour Local hour (default noon avoids DST edge cases when adding days).
 */
export function dateKeyToTZDate(
  key: string,
  timeZone: string,
  hour = 12,
  minute = 0,
  second = 0,
): TZDate | null {
  const m = DATE_KEY_RE.exec(key)
  if (!m) return null
  const zoned = new TZDate(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    hour,
    minute,
    second,
    timeZone,
  )
  return isValid(zoned) ? zoned : null
}

export function berlinDateKeyToTZDate(
  key: string,
  hour = 12,
  minute = 0,
  second = 0,
): TZDate | null {
  return dateKeyToTZDate(key, BERLIN_TIME_ZONE, hour, minute, second)
}

export function parseBerlinDateKey(key: string): TZDate | null {
  return berlinDateKeyToTZDate(key, 12, 0, 0)
}

/** Weekday in Berlin (0 = Sunday … 6 = Saturday). */
export function berlinWeekdayFromDateKey(key: string): number | null {
  const berlin = parseBerlinDateKey(key)
  if (!berlin) return null
  return berlin.getDay()
}

/** Add calendar days to a `YYYY-MM-DD` key in `timeZone`. */
export function addCalendarDateKeyDays(key: string, days: number, timeZone: string): string {
  const zoned = dateKeyToTZDate(key, timeZone, 12, 0, 0)
  if (!zoned) return key
  const next = addDays(zoned, days)
  return format(new TZDate(next.getTime(), timeZone), 'yyyy-MM-dd')
}

export function addBerlinDateKeyDays(key: string, days: number): string {
  return addCalendarDateKeyDays(key, days, BERLIN_TIME_ZONE)
}

/** Inclusive range of `YYYY-MM-DD` keys from `fromKey` through `toKey`. */
export function berlinDateKeyRange(fromKey: string, toKey: string): string[] {
  const keys: string[] = []
  let cur = fromKey
  const guard = 400
  let n = 0
  while (cur <= toKey && n < guard) {
    keys.push(cur)
    cur = addBerlinDateKeyDays(cur, 1)
    n++
  }
  return keys
}

/** 21-day window centered on today: past 10, today, next 10. */
export function timelineDateKeys(centerKey: string = berlinTodayDateKey()): string[] {
  const from = addBerlinDateKeyDays(centerKey, -10)
  const to = addBerlinDateKeyDays(centerKey, 10)
  return berlinDateKeyRange(from, to)
}
