import { appendFileSync } from 'node:fs'

export type CacheDecisionState = 'hit' | 'miss' | 'stale' | 'forced-refresh' | 'not-found'
export type CacheDecisionAction = 'reuse' | 'refresh' | 'skip'

export function mapDailyRefreshReasonToCacheState(reason: string): CacheDecisionState {
  if (reason === 'force') return 'forced-refresh'
  if (reason === 'cache_missing') return 'miss'
  if (reason === 'cache_stale_previous_window') return 'stale'
  if (
    reason === 'cache_used_current_window' ||
    reason === 'cache_used_missing_cached_at' ||
    reason === 'cache_used_invalid_cached_at'
  ) {
    return 'hit'
  }
  return 'not-found'
}

export function emitCacheDecision(params: {
  source: string
  decision: CacheDecisionState
  reason: string
  action: CacheDecisionAction
  area?: string
  detail?: string
  timezone?: string
  currentWindow?: string
  cachedWindow?: string
}): void {
  const tokens = Object.entries({
    source: params.source,
    area: params.area,
    decision: params.decision,
    reason: params.reason,
    action: params.action,
    detail: params.detail,
    timezone: params.timezone,
    currentWindow: params.currentWindow,
    cachedWindow: params.cachedWindow,
  })
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${key}=${value}`)
    .join(' ')

  console.log(`[cache] ${tokens}`)

  const stepSummaryPath = process.env.GITHUB_STEP_SUMMARY?.trim()
  if (!stepSummaryPath) {
    return
  }

  const areaPrefix = params.area ? ` (${params.area})` : ''
  const detailSuffix = params.detail ? ` - ${params.detail}` : ''
  const summaryLine = `- ${params.source}${areaPrefix}: ${params.decision} (${params.reason}) -> ${params.action}${detailSuffix}`
  appendFileSync(stepSummaryPath, `${summaryLine}\n`, { encoding: 'utf-8' })
}
