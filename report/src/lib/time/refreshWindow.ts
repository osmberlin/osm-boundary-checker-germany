import { TZDate } from '@date-fns/tz'
import { addDays, format } from 'date-fns'

/**
 * Daily refresh window key for cache reuse: the local calendar day, or the
 * previous local day when `at` is before `notBeforeLocalHour` in `timeZone`.
 */
export function refreshWindowKey(at: Date, timeZone: string, notBeforeLocalHour: number): string {
  const zoned = new TZDate(at.getTime(), timeZone)
  if (zoned.getHours() >= notBeforeLocalHour) {
    return format(zoned, 'yyyy-MM-dd')
  }
  return format(addDays(zoned, -1), 'yyyy-MM-dd')
}
