import { BERLIN_TIME_ZONE } from '../../report/src/lib/time/constants.ts'
import { refreshWindowKey } from '../../report/src/lib/time/refreshWindow.ts'

const DEFAULT_REFRESH_TIMEZONE = BERLIN_TIME_ZONE
const DEFAULT_NOT_BEFORE_LOCAL_HOUR = 1

export type DailyRefreshDecisionReason =
  | 'force'
  | 'cache_missing'
  | 'cache_used_current_window'
  | 'cache_stale_previous_window'
  | 'cache_used_missing_cached_at'
  | 'cache_used_invalid_cached_at'

export type DailyRefreshDecision = {
  shouldDownload: boolean
  reason: DailyRefreshDecisionReason
  because: string
  timezone: string
  notBeforeLocalHour: number
  currentWindowKey: string
  cachedWindowKey?: string
}

export function resolveRefreshTimezone(env: NodeJS.ProcessEnv = process.env): string {
  const timezone =
    env.DOWNLOAD_REFRESH_TIMEZONE?.trim() ||
    env.PIPELINE_TIMEZONE?.trim() ||
    env.TZ?.trim() ||
    DEFAULT_REFRESH_TIMEZONE
  return timezone
}

export function decideDailyRefresh(params: {
  force: boolean
  cacheExists: boolean
  cachedAt?: string
  now?: Date
  timezone?: string
  notBeforeLocalHour?: number
}): DailyRefreshDecision {
  const now = params.now ?? new Date()
  const timezone = params.timezone ?? DEFAULT_REFRESH_TIMEZONE
  const notBeforeLocalHour = params.notBeforeLocalHour ?? DEFAULT_NOT_BEFORE_LOCAL_HOUR
  const currentWindowKey = refreshWindowKey(now, timezone, notBeforeLocalHour)

  if (params.force) {
    return {
      shouldDownload: true,
      reason: 'force',
      because: 'force_flag',
      timezone,
      notBeforeLocalHour,
      currentWindowKey,
    }
  }

  if (!params.cacheExists) {
    return {
      shouldDownload: true,
      reason: 'cache_missing',
      because: 'cache_missing',
      timezone,
      notBeforeLocalHour,
      currentWindowKey,
    }
  }

  const cachedAtRaw = params.cachedAt?.trim()
  if (!cachedAtRaw) {
    return {
      shouldDownload: false,
      reason: 'cache_used_missing_cached_at',
      because: 'cache_missing_timestamp',
      timezone,
      notBeforeLocalHour,
      currentWindowKey,
    }
  }

  const cachedDate = new Date(cachedAtRaw)
  if (Number.isNaN(cachedDate.getTime())) {
    return {
      shouldDownload: false,
      reason: 'cache_used_invalid_cached_at',
      because: 'cache_invalid_timestamp',
      timezone,
      notBeforeLocalHour,
      currentWindowKey,
    }
  }

  const cachedWindowKey = refreshWindowKey(cachedDate, timezone, notBeforeLocalHour)
  if (cachedWindowKey === currentWindowKey) {
    return {
      shouldDownload: false,
      reason: 'cache_used_current_window',
      because: 'within_daily_refresh_window',
      timezone,
      notBeforeLocalHour,
      currentWindowKey,
      cachedWindowKey,
    }
  }

  return {
    shouldDownload: true,
    reason: 'cache_stale_previous_window',
    because: 'new_daily_refresh_window',
    timezone,
    notBeforeLocalHour,
    currentWindowKey,
    cachedWindowKey,
  }
}
