import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const OSM_PIPELINE_STATE_FILE = 'osm-pipeline-state.json'
export const OSM_DOWNLOAD_ATTEMPTS_FILE = 'osm-download-attempts.json'

export const MAX_CONSECUTIVE_OSM_FALLBACK_RUNS = 2

export type OsmDownloadOutcome = 'fresh' | 'cache_window' | 'fallback_artifact' | 'failed'

export type OsmDownloadAttempt = {
  attempt: 'fresh' | 'fallback'
  outcome: OsmDownloadOutcome
  at: string
  exitCode?: number
  errorMessage?: string
}

export type OsmDownloadAttemptsFile = {
  version: 1
  runId: string
  fresh?: OsmDownloadAttempt
  fallback?: OsmDownloadAttempt
}

export type OsmPipelineState = {
  version: 1
  consecutiveFallbackRuns: number
  lastFreshDownloadAt?: string
  lastFallbackAt?: string
  lastFallbackRunId?: string
  lastErrorMessage?: string
  updatedAt: string
}

export type OsmDownloadPolicyResult = {
  ok: boolean
  finalOutcome: OsmDownloadOutcome
  consecutiveFallbackRuns: number
  errorMessage?: string
}

function safeNow(): string {
  return new Date().toISOString()
}

function readJsonOrNull<T>(path: string): T | null {
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as T
  } catch {
    return null
  }
}

function writeAtomic(path: string, body: unknown): void {
  mkdirSync(dirname(path), { recursive: true })
  const tmpPath = `${path}.tmp`
  writeFileSync(tmpPath, `${JSON.stringify(body, null, 2)}\n`, 'utf-8')
  renameSync(tmpPath, path)
}

export function osmPipelineStatePath(processingDir: string): string {
  return join(processingDir, OSM_PIPELINE_STATE_FILE)
}

export function osmDownloadAttemptsPath(processingDir: string): string {
  return join(processingDir, OSM_DOWNLOAD_ATTEMPTS_FILE)
}

export function readOsmPipelineState(path: string): OsmPipelineState | null {
  const parsed = readJsonOrNull<OsmPipelineState>(path)
  if (!parsed || parsed.version !== 1) return null
  return parsed
}

export function readOsmDownloadAttempts(path: string): OsmDownloadAttemptsFile | null {
  const parsed = readJsonOrNull<OsmDownloadAttemptsFile>(path)
  if (!parsed || parsed.version !== 1) return null
  return parsed
}

export function upsertOsmDownloadAttempt(
  processingDir: string,
  runId: string,
  attempt: OsmDownloadAttempt,
): OsmDownloadAttemptsFile {
  const path = osmDownloadAttemptsPath(processingDir)
  const current = readOsmDownloadAttempts(path)
  const next: OsmDownloadAttemptsFile = {
    version: 1,
    runId,
    fresh: current?.runId === runId ? current.fresh : undefined,
    fallback: current?.runId === runId ? current.fallback : undefined,
  }
  if (attempt.attempt === 'fresh') next.fresh = attempt
  else next.fallback = attempt
  writeAtomic(path, next)
  return next
}

export function resolveOsmDownloadOutcome(params: {
  stepStatus: 'ok' | 'fail' | 'skipped'
  usedCache: boolean
  reason?: string
}): OsmDownloadOutcome {
  if (params.stepStatus === 'fail') return 'failed'
  if (params.stepStatus === 'skipped' && params.reason === 'fallback_osm_cache_restored') {
    return 'fallback_artifact'
  }
  if (params.stepStatus === 'ok' && params.usedCache) return 'cache_window'
  if (params.stepStatus === 'ok') return 'fresh'
  if (params.stepStatus === 'skipped' && params.usedCache) return 'cache_window'
  return 'failed'
}

export function evaluateOsmDownloadPolicy(params: {
  previousState: OsmPipelineState | null
  attempts: OsmDownloadAttemptsFile | null
  now?: string
}): OsmDownloadPolicyResult {
  const now = params.now ?? safeNow()
  const previousRuns = params.previousState?.consecutiveFallbackRuns ?? 0
  const fresh = params.attempts?.fresh
  const fallback = params.attempts?.fallback

  const freshOk =
    fresh?.outcome === 'fresh' || fresh?.outcome === 'cache_window' ? fresh.outcome : null
  if (freshOk) {
    return {
      ok: true,
      finalOutcome: freshOk,
      consecutiveFallbackRuns: 0,
    }
  }

  if (fallback?.outcome === 'fresh' || fallback?.outcome === 'cache_window') {
    return {
      ok: true,
      finalOutcome: fallback.outcome,
      consecutiveFallbackRuns: 0,
    }
  }

  if (fallback?.outcome === 'fallback_artifact') {
    const consecutiveFallbackRuns = previousRuns + 1
    if (consecutiveFallbackRuns > MAX_CONSECUTIVE_OSM_FALLBACK_RUNS) {
      return {
        ok: false,
        finalOutcome: 'fallback_artifact',
        consecutiveFallbackRuns,
        errorMessage:
          fresh?.errorMessage ??
          fallback.errorMessage ??
          `OSM fallback cache used ${consecutiveFallbackRuns} consecutive runs (limit ${MAX_CONSECUTIVE_OSM_FALLBACK_RUNS})`,
      }
    }
    return {
      ok: true,
      finalOutcome: 'fallback_artifact',
      consecutiveFallbackRuns,
      errorMessage: fresh?.errorMessage,
    }
  }

  const errorMessage =
    fallback?.errorMessage ??
    fresh?.errorMessage ??
    'OSM PBF download failed on fresh and fallback attempts'
  return {
    ok: false,
    finalOutcome: 'failed',
    consecutiveFallbackRuns: previousRuns,
    errorMessage,
  }
}

export function writeOsmPipelineState(
  processingDir: string,
  state: Omit<OsmPipelineState, 'version' | 'updatedAt'>,
): OsmPipelineState {
  const next: OsmPipelineState = {
    version: 1,
    ...state,
    updatedAt: safeNow(),
  }
  writeAtomic(osmPipelineStatePath(processingDir), next)
  return next
}
