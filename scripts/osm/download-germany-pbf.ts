#!/usr/bin/env bun
import { spawnSync } from 'node:child_process'
/**
 * Download Geofabrik Germany PBF into `.cache/osm/germany-latest.osm.pbf` (gitignored).
 * Resolves the dated daily file from `germany-updates/state.txt` (public `germany-latest` can lag).
 * Uses `curl -fL` on PATH. Override with `--url` or a custom `GERMANY_OSM_PBF_URL` (not the default latest URL).
 *
 * Re-download is gated by the daily refresh window (`decideDailyRefresh`): at most one
 * network fetch per calendar day in the configured timezone unless `--force`.
 *
 * Set **`OSM_SKIP_PBF_DOWNLOAD=1`** (or `true`) to never hit the network here — use when the PBF
 * is already present and you want `scripts/pipeline/nightly.ts` / `download -- --yes --targets pbf` to leave it unchanged
 * (e.g. local runs across calendar-day refresh windows).
 */
import { existsSync, mkdirSync, statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { emitCacheDecision, mapDailyRefreshReasonToCacheState } from '../shared/cacheDecision.ts'
import { decideDailyRefresh, resolveRefreshTimezone } from '../shared/dailyRefreshWindow.ts'
import { resolveGeofabrikGermanyPbfUrl } from '../shared/geofabrikGermanyExtract.ts'
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

async function main() {
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
        ? `Remove the file or unset OSM_SKIP_PBF_DOWNLOAD, then run: bun run download -- --yes --targets pbf --force`
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
  const explicitUrl = urlArg?.trim() || process.env.GERMANY_OSM_PBF_URL?.trim() || ''
  const useExplicitOnly = explicitUrl.length > 0 && explicitUrl !== GERMANY_OSM_PBF_URL
  const resolved = await resolveGeofabrikGermanyPbfUrl({
    explicitUrl: useExplicitOnly ? explicitUrl : null,
  })
  const downloadUrl = resolved.url
  if (resolved.resolvedVia === 'dated_from_state') {
    console.log(
      `Geofabrik extract resolved from replication state: ${resolved.basename} (OSM data up to ${resolved.replicationTimestamp})`,
    )
  } else if (resolved.resolvedVia === 'latest_fallback') {
    console.warn(
      'Could not read Geofabrik germany-updates/state.txt; falling back to germany-latest.osm.pbf (symlink may be stale).',
    )
  }

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

  const curlDownload = (url: string): number => {
    const r = spawnSync(
      'curl',
      ['-fL', '--no-progress-meter', '--retry', '3', '--retry-delay', '2', '-o', dest, url],
      { stdio: 'inherit' },
    )
    if (r.error) {
      console.error(r.error)
      return 1
    }
    return r.status ?? 1
  }

  let status = curlDownload(downloadUrl)
  if (
    status === 22 &&
    resolved.resolvedVia === 'dated_from_state' &&
    downloadUrl !== GERMANY_OSM_PBF_URL
  ) {
    console.warn(
      `Dated Geofabrik extract not published yet (${resolved.basename}); retrying ${GERMANY_OSM_PBF_BASENAME}.`,
    )
    try {
      unlinkSync(dest)
    } catch {
      // ignore partial download cleanup
    }
    status = curlDownload(GERMANY_OSM_PBF_URL)
  }

  if (status !== 0) {
    process.exit(status)
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

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
