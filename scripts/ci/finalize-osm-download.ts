#!/usr/bin/env bun
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  evaluateOsmDownloadPolicy,
  osmDownloadAttemptsPath,
  osmPipelineStatePath,
  readOsmDownloadAttempts,
  readOsmPipelineState,
  writeOsmPipelineState,
} from '../shared/osmPipelineState.ts'
import { upsertSharedBranchStatus } from '../shared/runStatus.ts'
import { runtimeRootFromWorkspace } from '../shared/runtimeRoot.ts'
import { workspaceRootFromHere } from '../shared/workspaceRoot.ts'

function main(): void {
  const workspaceRoot = workspaceRootFromHere(import.meta.url)
  const runtimeRoot = runtimeRootFromWorkspace(workspaceRoot)
  const processingDir = join(runtimeRoot, 'data')

  const previousPath = process.env.PREVIOUS_OSM_PIPELINE_STATE_PATH?.trim()
  const previousState =
    previousPath && existsSync(previousPath)
      ? readOsmPipelineState(previousPath)
      : readOsmPipelineState(osmPipelineStatePath(processingDir))

  const attempts = readOsmDownloadAttempts(osmDownloadAttemptsPath(processingDir))
  const policy = evaluateOsmDownloadPolicy({ previousState, attempts })
  const now = new Date().toISOString()

  writeOsmPipelineState(processingDir, {
    consecutiveFallbackRuns: policy.consecutiveFallbackRuns,
    lastFreshDownloadAt:
      policy.finalOutcome === 'fresh' || policy.finalOutcome === 'cache_window'
        ? now
        : previousState?.lastFreshDownloadAt,
    lastFallbackAt:
      policy.finalOutcome === 'fallback_artifact' ? now : previousState?.lastFallbackAt,
    lastFallbackRunId:
      policy.finalOutcome === 'fallback_artifact'
        ? attempts?.runId
        : previousState?.lastFallbackRunId,
    lastErrorMessage: policy.errorMessage ?? (policy.ok ? undefined : policy.errorMessage),
  })

  const sourceOrigin =
    policy.finalOutcome === 'failed'
      ? undefined
      : policy.finalOutcome === 'fallback_artifact'
        ? ('fallback_artifact' as const)
        : policy.finalOutcome === 'cache_window'
          ? ('cache_window' as const)
          : ('fresh' as const)

  upsertSharedBranchStatus(processingDir, 'download:osm', {
    status: policy.ok ? 'success' : 'failed_no_cache',
    usedCache:
      policy.finalOutcome === 'fallback_artifact' || policy.finalOutcome === 'cache_window',
    sourceOrigin,
    errorMessage: policy.errorMessage,
    errorCode: policy.ok ? undefined : 'osm_download_policy',
    retryHint: policy.ok ? undefined : 'automatic retry next nightly run',
  })

  console.log(
    `[finalize-osm-download] outcome=${policy.finalOutcome} ok=${policy.ok} consecutiveFallbackRuns=${policy.consecutiveFallbackRuns}`,
  )
  if (policy.errorMessage) {
    console.error(`[finalize-osm-download] ${policy.errorMessage}`)
  }
  if (!policy.ok) process.exit(1)
}

main()
