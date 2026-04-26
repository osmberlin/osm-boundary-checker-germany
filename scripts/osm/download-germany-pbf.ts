#!/usr/bin/env bun
import { spawnSync } from 'node:child_process'
/**
 * Download Geofabrik `germany-latest.osm.pbf` into `.cache/osm/` (gitignored).
 * Uses `curl` on PATH. Override URL with `--url` or `GERMANY_OSM_PBF_URL`.
 */
import { existsSync, mkdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { emitCacheDecision, mapDailyRefreshReasonToCacheState } from '../shared/cacheDecision.ts'
import { decideDailyRefresh, resolveRefreshTimezone } from '../shared/dailyRefreshWindow.ts'
import {
  GERMANY_OSM_CACHE_DIR,
  GERMANY_OSM_PBF_BASENAME,
  GERMANY_OSM_PBF_URL,
} from '../shared/germanyOsmPbf.ts'
import { runtimeRootFromWorkspace } from '../shared/runtimeRoot.ts'
import { workspaceRootFromHere } from '../shared/workspaceRoot.ts'

function parseArgs(argv: string[]) {
  let force = false
  let url: string | null = null
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--force') force = true
    if (argv[i] === '--url') {
      const v = argv[i + 1]
      if (v !== undefined) {
        url = v
        i++
      }
    }
  }
  return { force, url }
}

function main() {
  const workspaceRoot = workspaceRootFromHere(import.meta.url)
  const runtimeRoot = runtimeRootFromWorkspace(workspaceRoot)
  const { force, url: urlArg } = parseArgs(process.argv.slice(2))
  const downloadUrl =
    urlArg?.trim() || process.env.GERMANY_OSM_PBF_URL?.trim() || GERMANY_OSM_PBF_URL

  const dir = join(runtimeRoot, GERMANY_OSM_CACHE_DIR)
  const dest = join(dir, GERMANY_OSM_PBF_BASENAME)
  const timezone = resolveRefreshTimezone()

  mkdirSync(dir, { recursive: true })

  const cacheExists = existsSync(dest)
  const cachedAt = cacheExists ? statSync(dest).mtime.toISOString() : undefined
  const decision = decideDailyRefresh({
    force,
    cacheExists,
    cachedAt,
    timezone,
  })
  if (!decision.shouldDownload) {
    emitCacheDecision({
      source: 'osm',
      decision: mapDailyRefreshReasonToCacheState(decision.reason),
      reason: decision.reason,
      action: 'reuse',
      detail: decision.because,
      timezone: decision.timezone,
      currentWindow: decision.currentWindowKey,
      cachedWindow: decision.cachedWindowKey,
    })
    console.log(
      `Download skipped (cache used because ${decision.because}; timezone=${decision.timezone}; currentWindow=${decision.currentWindowKey}; cachedWindow=${decision.cachedWindowKey ?? 'unknown'}; use --force to re-download):\n  ${dest}`,
    )
    return
  }
  emitCacheDecision({
    source: 'osm',
    decision: mapDailyRefreshReasonToCacheState(decision.reason),
    reason: decision.reason,
    action: 'refresh',
    detail: decision.because,
    timezone: decision.timezone,
    currentWindow: decision.currentWindowKey,
    cachedWindow: decision.cachedWindowKey,
  })
  if (decision.reason === 'cache_stale_previous_window') {
    console.log(
      `Download required (because ${decision.because}; timezone=${decision.timezone}; currentWindow=${decision.currentWindowKey}; cachedWindow=${decision.cachedWindowKey})`,
    )
  }

  console.log(`Downloading:\n  ${downloadUrl}\n→ ${dest}`)

  const r = spawnSync(
    'curl',
    ['-fL', '--no-progress-meter', '--retry', '3', '--retry-delay', '2', '-o', dest, downloadUrl],
    { stdio: 'inherit' },
  )

  if (r.error) {
    console.error(r.error)
    process.exit(1)
  }
  if (r.status !== 0) {
    process.exit(r.status ?? 1)
  }
  console.log('Done.')
}

main()
