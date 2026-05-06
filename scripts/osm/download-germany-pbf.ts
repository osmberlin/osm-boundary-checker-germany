#!/usr/bin/env bun
import { spawnSync } from 'node:child_process'
/**
 * Download Geofabrik `germany-latest.osm.pbf` into `.cache/osm/` (gitignored).
 * Uses `curl` on PATH. Override URL with `--url` or `GERMANY_OSM_PBF_URL`.
 *
 * Set **`OSM_SKIP_PBF_DOWNLOAD=1`** (or `true`) to never hit the network here — use when the PBF
 * is already present and you want `pipeline:nightly` / `osm:download` to leave it unchanged
 * (e.g. local runs across calendar-day refresh windows).
 */
import { existsSync, mkdirSync, statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { emitCacheDecision, mapDailyRefreshReasonToCacheState } from '../shared/cacheDecision.ts'
import { decideDailyRefresh, resolveRefreshTimezone } from '../shared/dailyRefreshWindow.ts'
import {
  GERMANY_OSM_CACHE_DIR,
  GERMANY_OSM_PBF_BASENAME,
  GERMANY_OSM_PBF_URL,
} from '../shared/germanyOsmPbf.ts'
import { checkOsmPbfIntegrity } from '../shared/osmPbfIntegrity.ts'
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
  const dir = join(runtimeRoot, GERMANY_OSM_CACHE_DIR)
  const dest = join(dir, GERMANY_OSM_PBF_BASENAME)
  mkdirSync(dir, { recursive: true })

  const skipEnv = process.env.OSM_SKIP_PBF_DOWNLOAD?.trim().toLowerCase()
  if (skipEnv === '1' || skipEnv === 'true' || skipEnv === 'yes') {
    if (!existsSync(dest)) {
      console.error(
        `OSM_SKIP_PBF_DOWNLOAD is set but no PBF exists at:\n  ${dest}\n\nDownload once without the skip flag, or set OSM_GERMANY_PBF.`,
      )
      process.exit(1)
    }
    const skipIntegrity = checkOsmPbfIntegrity(dest)
    if (!skipIntegrity.ok) {
      const hint = skipIntegrity.canDeleteCorruptCache
        ? `Remove the file or unset OSM_SKIP_PBF_DOWNLOAD, then run: bun run osm:download -- --force`
        : `Install osmium on PATH so the PBF can be verified, or unset OSM_SKIP_PBF_DOWNLOAD.`
      console.error(
        `OSM_SKIP_PBF_DOWNLOAD is set but the cached PBF could not be validated:\n  ${dest}\n${skipIntegrity.detail}\n\n${hint}`,
      )
      process.exit(1)
    }
    emitCacheDecision({
      source: 'osm',
      decision: 'hit',
      reason: 'skip_env',
      action: 'reuse',
      detail: 'OSM_SKIP_PBF_DOWNLOAD',
    })
    console.log('OSM PBF download skipped (OSM_SKIP_PBF_DOWNLOAD set).')
    return
  }
  const downloadUrl =
    urlArg?.trim() || process.env.GERMANY_OSM_PBF_URL?.trim() || GERMANY_OSM_PBF_URL

  const timezone = resolveRefreshTimezone()

  if (existsSync(dest)) {
    const integ = checkOsmPbfIntegrity(dest)
    if (!integ.ok) {
      if (!integ.canDeleteCorruptCache) {
        console.error(
          `Cannot verify cached Germany PBF (osmium unavailable or failed to run):\n  ${dest}\n${integ.detail}`,
        )
        process.exit(1)
      }
      console.warn(
        `Cached Germany PBF failed integrity check (truncated or corrupt). Removing and re-downloading:\n  ${dest}\n${integ.detail}`,
      )
      unlinkSync(dest)
    }
  }

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

  const postIntegrity = checkOsmPbfIntegrity(dest)
  if (!postIntegrity.ok) {
    if (postIntegrity.canDeleteCorruptCache) {
      console.error(
        `Downloaded PBF failed integrity check. Removing partial file:\n  ${dest}\n${postIntegrity.detail}`,
      )
      try {
        unlinkSync(dest)
      } catch {
        // ignore
      }
    } else {
      console.error(
        `Downloaded PBF could not be verified (osmium unavailable or failed to run):\n  ${dest}\n${postIntegrity.detail}`,
      )
    }
    process.exit(1)
  }

  console.log('Done.')
}

main()
