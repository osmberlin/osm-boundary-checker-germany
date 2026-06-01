import { berlinDateKeyRange, berlinDateKeyToTZDate, berlinWeekdayFromDateKey } from './calendar'

/** Weekdays for data-refresh.yml cron: Sun, Wed, Fri, Sat (0=Sun … 6=Sat). */
export const REFRESH_WEEKDAYS = new Set([0, 3, 5, 6])

/** Scheduled local hour in Europe/Berlin (matches workflow cron). */
export const REFRESH_HOUR_BERLIN = 4

export type ScheduledRefreshSlot = {
  dateKey: string
  /** ISO instant for 04:00 Europe/Berlin on that calendar day. */
  scheduledAtIso: string
}

export function isScheduledRefreshDay(dateKey: string): boolean {
  const wd = berlinWeekdayFromDateKey(dateKey)
  return wd != null && REFRESH_WEEKDAYS.has(wd)
}

/** 04:00 Europe/Berlin on `dateKey` as ISO string. */
export function scheduledRefreshAtIso(dateKey: string): string {
  const berlin = berlinDateKeyToTZDate(dateKey, REFRESH_HOUR_BERLIN, 0, 0)
  return berlin?.toISOString() ?? ''
}

export function scheduledRefreshSlot(dateKey: string): ScheduledRefreshSlot | null {
  if (!isScheduledRefreshDay(dateKey)) return null
  const scheduledAtIso = scheduledRefreshAtIso(dateKey)
  if (!scheduledAtIso) return null
  return { dateKey, scheduledAtIso }
}

export function scheduledSlotsInRange(fromKey: string, toKey: string): ScheduledRefreshSlot[] {
  return berlinDateKeyRange(fromKey, toKey)
    .map((dateKey) => scheduledRefreshSlot(dateKey))
    .filter((s): s is ScheduledRefreshSlot => s != null)
}
