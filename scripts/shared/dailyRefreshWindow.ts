const DEFAULT_REFRESH_TIMEZONE = 'Europe/Berlin'
const DEFAULT_NOT_BEFORE_LOCAL_HOUR = 1
const ONE_DAY_MS = 24 * 60 * 60 * 1000

type LocalParts = {
  year: number
  month: number
  day: number
  hour: number
}

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

function readLocalParts(at: Date, timezone: string): LocalParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at)
  const pick = (type: string) => Number(parts.find((part) => part.type === type)?.value)
  return {
    year: pick('year'),
    month: pick('month'),
    day: pick('day'),
    hour: pick('hour'),
  }
}

function dayKey(parts: Pick<LocalParts, 'year' | 'month' | 'day'>): string {
  const y = String(parts.year).padStart(4, '0')
  const m = String(parts.month).padStart(2, '0')
  const d = String(parts.day).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function refreshWindowKey(at: Date, timezone: string, notBeforeLocalHour: number): string {
  const local = readLocalParts(at, timezone)
  if (local.hour >= notBeforeLocalHour) return dayKey(local)
  const previousDay = new Date(at.getTime() - ONE_DAY_MS)
  const previousLocal = readLocalParts(previousDay, timezone)
  return dayKey(previousLocal)
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
