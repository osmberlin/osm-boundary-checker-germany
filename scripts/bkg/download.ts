#!/usr/bin/env bun
import { spawnSync } from 'node:child_process'
/**
 * BKG VG25: fetch GDZ **Aktualitätsstand**, optionally fetch ZIP when stand changed,
 * unzip → `.cache/bkg/extract/…`, write `download-metadata.json`.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
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
import type { BkgDownloadMetadata } from '../shared/bkgDownloadMetadata.ts'
import { bkgDownloadMetadataSchema } from '../shared/bkgDownloadMetadata.ts'
import {
  fetchBkgVg25GdzProductHtml,
  parseBkgVg25AktualitaetsstandFromHtml,
} from '../shared/bkgGdzCatalog.ts'
import { emitCacheDecision } from '../shared/cacheDecision.ts'
import { BKG_VG25_GDZ_PRODUCT_PAGE_URL } from '../shared/officialProfiles.ts'
import { runtimeRootFromWorkspace } from '../shared/runtimeRoot.ts'
import { workspaceRootFromHere } from '../shared/workspaceRoot.ts'

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
  const preferred =
    paths.find((p) => /DE_VG25\.gpkg$/i.test(p)) || paths.find((p) => /DE_VG250\.gpkg$/i.test(p))
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

function readPriorMeta(cacheDir: string): BkgDownloadMetadata | null {
  const p = join(cacheDir, BKG_DOWNLOAD_METADATA)
  if (!existsSync(p)) return null
  try {
    const raw = JSON.parse(readFileSync(p, 'utf-8')) as unknown
    return bkgDownloadMetadataSchema.parse(raw)
  } catch {
    return null
  }
}

async function main() {
  const workspaceRoot = workspaceRootFromHere(import.meta.url)
  const runtimeRoot = runtimeRootFromWorkspace(workspaceRoot)
  const { zipPath: localZip, force } = parseArgs(process.argv.slice(2))

  const cacheDir = join(runtimeRoot, BKG_CACHE_DIR)
  const zipDest = join(cacheDir, BKG_ZIP_NAME)
  const extractDir = join(cacheDir, BKG_EXTRACT_SUBDIR)
  const extractTmp = `${extractDir}.tmp-${Date.now()}`

  mkdirSync(cacheDir, { recursive: true })

  const html = await fetchBkgVg25GdzProductHtml(BKG_VG25_GDZ_PRODUCT_PAGE_URL)
  const stand = parseBkgVg25AktualitaetsstandFromHtml(html)
  if (!stand) {
    console.error(
      'Could not parse BKG VG25 Aktualitätsstand from GDZ product HTML. Regex/update page?',
    )
    process.exit(1)
  }
  const sourceUpdatedAt = new Date(`${stand.sourceDateIsoDate}T12:00:00.000Z`).toISOString()
  const sourceUpdatedAtVerifiedAt = new Date().toISOString()

  const prior = readPriorMeta(cacheDir)
  const zipExists = existsSync(zipDest)

  let fetchedZipBytes = false
  if (localZip) {
    const absZip = resolve(process.cwd(), localZip)
    if (!existsSync(absZip)) {
      console.error(`File not found: ${absZip}`)
      process.exit(1)
    }
    copyFileSync(absZip, zipDest)
    fetchedZipBytes = true
    emitCacheDecision({
      source: 'bkg',
      decision: 'forced-refresh',
      reason: 'local_zip_override',
      action: 'refresh',
      detail: 'provided via --zip',
    })
    console.log(`Copied local ZIP to ${zipDest}`)
  } else {
    const standUnchanged = prior?.sourceUpdatedAt === sourceUpdatedAt
    const skipZip = !force && standUnchanged && zipExists
    if (skipZip) {
      emitCacheDecision({
        source: 'bkg',
        decision: 'hit',
        reason: 'source_updated_at_unchanged',
        action: 'reuse',
        detail: `Aktualitaetsstand ${stand.displayDe} unchanged`,
      })
      console.log(
        `BKG ZIP skipped (Aktualitaetsstand unchanged ${stand.displayDe}; use --force to re-download): ${zipDest}`,
      )
    } else {
      emitCacheDecision({
        source: 'bkg',
        decision: standUnchanged ? 'miss' : 'stale',
        reason: force ? 'force_flag' : standUnchanged ? 'missing_zip' : 'source_updated_at_changed',
        action: 'refresh',
        detail: force ? 'force' : standUnchanged ? 'zip_missing' : 'new_stand',
      })
      console.log(`Fetching ${BKG_ZIP_URL}`)
      const buf = await downloadZipWithRetry(BKG_ZIP_URL)
      writeFileSync(zipDest, buf)
      fetchedZipBytes = true
      console.log(`Wrote ${zipDest} (${buf.length} bytes)`)
    }
  }

  rmSync(extractTmp, { recursive: true, force: true })
  const unzip = spawnSync('unzip', ['-o', zipDest, '-d', extractTmp], {
    stdio: 'inherit',
  })
  if (unzip.status !== 0) {
    console.error('`unzip` failed. Install unzip or extract the archive manually into', extractDir)
    rmSync(extractTmp, { recursive: true, force: true })
    process.exit(unzip.status ?? 1)
  }

  const gpkgPaths = findGpkgFiles(extractTmp)
  if (gpkgPaths.length === 0) {
    console.error('No .gpkg found under', extractTmp)
    rmSync(extractTmp, { recursive: true, force: true })
    process.exit(1)
  }
  let gpkgAbs = ''
  try {
    rmSync(extractDir, { recursive: true, force: true })
    renameSync(extractTmp, extractDir)
    gpkgAbs = pickGpkg(gpkgPaths).replace(extractTmp, extractDir)
  } finally {
    if (existsSync(extractTmp)) rmSync(extractTmp, { recursive: true, force: true })
  }

  let downloadedAt: string
  if (fetchedZipBytes) {
    downloadedAt = new Date().toISOString()
  } else if (prior?.downloadedAt) {
    downloadedAt = prior.downloadedAt
  } else if (zipExists) {
    downloadedAt = statSync(zipDest).mtime.toISOString()
  } else {
    throw new Error('Internal error: no ZIP and no prior downloadedAt')
  }

  const meta: BkgDownloadMetadata = {
    sourceUpdatedAt,
    sourceUpdatedAtVerifiedAt,
    downloadedAt,
    sourceUrl: BKG_ZIP_URL,
    zipRelativePath: relative(runtimeRoot, zipDest),
    gpkgRelativePath: relative(runtimeRoot, gpkgAbs),
  }
  writeFileSync(join(cacheDir, BKG_DOWNLOAD_METADATA), JSON.stringify(meta, null, 2), 'utf-8')

  console.log('download-metadata.json updated.')
  console.log('GPKG:', relative(workspaceRoot, gpkgAbs))
  console.log(`Aktualitaetsstand: ${stand.displayDe} (${sourceUpdatedAt})`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
