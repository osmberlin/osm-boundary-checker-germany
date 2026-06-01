import { TZDate } from '@date-fns/tz'
import { isValid } from 'date-fns'
import { BERLIN_TIME_ZONE } from './constants'

/** Parse an ISO (or Date-parseable) instant as wall time in `timeZone`. */
export function parseInstantInTimeZone(value: string, timeZone: string): TZDate | null {
  const t = value.trim()
  if (!t) return null
  const zoned = new TZDate(t, timeZone)
  if (isValid(zoned)) return zoned
  const fallback = new Date(t)
  if (!isValid(fallback)) return null
  return new TZDate(fallback.getTime(), timeZone)
}

/** Parse an ISO instant in Europe/Berlin. */
export function parseIsoToBerlin(value: string): TZDate | null {
  return parseInstantInTimeZone(value, BERLIN_TIME_ZONE)
}

export function parseIsoToBerlinOrThrow(value: string): TZDate {
  const berlin = parseIsoToBerlin(value)
  if (!berlin) {
    throw new Error(`Invalid ISO timestamp in report payload: ${value}`)
  }
  return berlin
}

/** Current instant as Europe/Berlin wall clock. */
export function berlinNow(): TZDate {
  return new TZDate(Date.now(), BERLIN_TIME_ZONE)
}
