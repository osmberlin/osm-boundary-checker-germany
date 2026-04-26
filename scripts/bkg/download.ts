#!/usr/bin/env bun
import { spawnSync } from 'node:child_process'
/**
 * Download BKG VG25 utm32s GeoPackage (ZIP) into `.cache/bkg/`, unzip, record `downloadedAt`.
 * Requires `unzip` on PATH (macOS/Linux). Use `--zip /path/to/vg25.utm32s.gpkg.zip` to seed from a local file instead of HTTP.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { join, relative, resolve } from 'node:path'
import {
  BKG_CACHE_DIR,
  BKG_DOWNLOAD_METADATA,
  BKG_EXTRACT_SUBDIR,
  BKG_ZIP_NAME,
  BKG_ZIP_URL,
} from '../shared/bkg.ts'
import { emitCacheDecision, mapDailyRefreshReasonToCacheState } from '../shared/cacheDecision.ts'
import { decideDailyRefresh, resolveRefreshTimezone } from '../shared/dailyRefreshWindow.ts'
import { runtimeRootFromWorkspace } from '../shared/runtimeRoot.ts'
import { workspaceRootFromHere } from '../shared/workspaceRoot.ts'

type DownloadMetadata = {
  downloadedAt: string
  sourceUrl: string
  zipRelativePath: string
  /** Path to `.gpkg` relative to workspace root. */
  gpkgRelativePath: string
}

function parseArgs(argv: string[]) {
  let zipPath: string | null = null
  let force = false
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--zip') {
      const v = argv[i + 1]
      if (v !== undefined) {
        zipPath = v
        i++
      }
    }
    if (argv[i] === '--force') force = true
  }
  return { zipPath, force }
}

function findGpkgFiles(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...findGpkgFiles(p))
    else if (e.isFile() && p.toLowerCase().endsWith('.gpkg')) out.push(p)
  }
  return out
}

function pickGpkg(paths: string[]): string {
  const preferred = paths.find((p) => /DE_VG250\.gpkg$/i.test(p))
  if (preferred) return preferred
  const fallback = paths[0]
  if (!fallback) {
    throw new Error('No .gpkg files found in extracted archive')
  }
  return fallback
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRetriableHttpStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500
}

function isRetriableNetworkError(error: unknown): boolean {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? (error as { code?: unknown }).code
      : ''
  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message?: unknown }).message ?? '')
      : ''
  const normalizedCode = typeof code === 'string' ? code.toUpperCase() : ''
  if (
    normalizedCode === 'ECONNRESET' ||
    normalizedCode === 'ETIMEDOUT' ||
    normalizedCode === 'EAI_AGAIN' ||
    normalizedCode === 'ECONNABORTED'
  ) {
    return true
  }
  return message.includes('socket connection was closed unexpectedly')
}

async function downloadZipWithRetry(url: string): Promise<Buffer> {
  const maxAttempts = 4
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url)
      if (!res.ok) {
        if (attempt < maxAttempts && isRetriableHttpStatus(res.status)) {
          const waitMs = attempt * 5_000
          console.warn(
            `HTTP ${res.status} ${res.statusText} while fetching BKG zip (attempt ${attempt}/${maxAttempts}); retrying in ${Math.round(waitMs / 1000)}s`,
          )
          await sleep(waitMs)
          continue
        }
        throw new Error(`HTTP ${res.status} ${res.statusText}`)
      }
      return Buffer.from(await res.arrayBuffer())
    } catch (error) {
      if (attempt < maxAttempts && isRetriableNetworkError(error)) {
        const waitMs = attempt * 5_000
        console.warn(
          `Transient download error while fetching BKG zip (attempt ${attempt}/${maxAttempts}); retrying in ${Math.round(waitMs / 1000)}s`,
        )
        await sleep(waitMs)
        continue
      }
      throw error
    }
  }

  throw new Error('Failed to download BKG zip after retries')
}

async function main() {
  const workspaceRoot = workspaceRootFromHere(import.meta.url)
  const runtimeRoot = runtimeRootFromWorkspace(workspaceRoot)
  const { zipPath: localZip, force } = parseArgs(process.argv.slice(2))

  const cacheDir = join(runtimeRoot, BKG_CACHE_DIR)
  const zipDest = join(cacheDir, BKG_ZIP_NAME)
  const extractDir = join(cacheDir, BKG_EXTRACT_SUBDIR)
  const timezone = resolveRefreshTimezone()

  mkdirSync(cacheDir, { recursive: true })

  if (!localZip) {
    const cacheExists = existsSync(zipDest)
    const cachedAt = cacheExists ? statSync(zipDest).mtime.toISOString() : undefined
    const decision = decideDailyRefresh({
      force,
      cacheExists,
      cachedAt,
      timezone,
    })
    if (!decision.shouldDownload) {
      emitCacheDecision({
        source: 'bkg',
        decision: mapDailyRefreshReasonToCacheState(decision.reason),
        reason: decision.reason,
        action: 'reuse',
        detail: decision.because,
        timezone: decision.timezone,
        currentWindow: decision.currentWindowKey,
        cachedWindow: decision.cachedWindowKey,
      })
      console.log(
        `Download skipped (cache used because ${decision.because}; timezone=${decision.timezone}; currentWindow=${decision.currentWindowKey}; cachedWindow=${decision.cachedWindowKey ?? 'unknown'}; use --force to re-download): ${zipDest}`,
      )
    } else {
      emitCacheDecision({
        source: 'bkg',
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
      console.log(`Fetching ${BKG_ZIP_URL}`)
      const buf = await downloadZipWithRetry(BKG_ZIP_URL)
      writeFileSync(zipDest, buf)
      console.log(`Wrote ${zipDest} (${buf.length} bytes)`)
    }
  } else if (localZip) {
    const absZip = resolve(process.cwd(), localZip)
    if (!existsSync(absZip)) {
      console.error(`File not found: ${absZip}`)
      process.exit(1)
    }
    copyFileSync(absZip, zipDest)
    console.log(`Copied local ZIP to ${zipDest}`)
    emitCacheDecision({
      source: 'bkg',
      decision: 'forced-refresh',
      reason: 'local_zip_override',
      action: 'refresh',
      detail: 'provided via --zip',
    })
  }

  // Keep only the latest extracted dataset to avoid stale archive leftovers.
  rmSync(extractDir, { recursive: true, force: true })
  const unzip = spawnSync('unzip', ['-o', zipDest, '-d', extractDir], {
    stdio: 'inherit',
  })
  if (unzip.status !== 0) {
    console.error('`unzip` failed. Install unzip or extract the archive manually into', extractDir)
    process.exit(unzip.status ?? 1)
  }

  const gpkgPaths = findGpkgFiles(extractDir)
  if (gpkgPaths.length === 0) {
    console.error('No .gpkg found under', extractDir)
    process.exit(1)
  }
  const gpkgAbs = pickGpkg(gpkgPaths)
  const gpkgRelativePath = relative(workspaceRoot, gpkgAbs)

  const meta: DownloadMetadata = {
    downloadedAt: new Date().toISOString(),
    sourceUrl: BKG_ZIP_URL,
    zipRelativePath: relative(runtimeRoot, zipDest),
    gpkgRelativePath: relative(runtimeRoot, gpkgAbs),
  }
  writeFileSync(join(cacheDir, BKG_DOWNLOAD_METADATA), JSON.stringify(meta, null, 2), 'utf-8')

  console.log('download-metadata.json updated.')
  console.log('GPKG:', gpkgRelativePath)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
