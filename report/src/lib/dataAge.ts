import { isValid, parseISO } from 'date-fns'

const DAY_MS = 24 * 60 * 60 * 1000

export function isOlderThanDays(rawIso: string | null | undefined, days: number): boolean {
  if (!rawIso) return false
  const d = parseISO(rawIso)
  if (!isValid(d)) {
    throw new Error(`Invalid ISO timestamp in report payload: ${rawIso}`)
  }
  const ms = d.getTime()
  return Date.now() - ms > days * DAY_MS
}
