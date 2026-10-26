import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { areaHasCompareConfig, loadAreaConfig } from '../../shared/areaConfig.ts'
import {
  DTP_AREAS_FILE,
  DTP_CACHE_DIR,
  DTP_CATEGORIES_FILE,
  DTP_DOWNLOAD_METADATA,
  DTP_GEOMETRY_SOURCES_FILE,
  DTP_INVENTORY_FILE,
  DTP_LICENSES_FILE,
  DTP_ORGANIZATIONS_FILE,
} from './constants.ts'

/**
 * How the nightly pipeline runs the DtP sync (`download:dtp` → `extract:dtp`).
 *
 * - The cache in `.cache/dtp` travels between GitHub runs as the `source-cache-dtp` artifact:
 *   each run restores the newest one, syncs only what changed and uploads it right after the
 *   download phase (also when later steps fail, so no download progress is lost).
 * - Without a cache (first run, expired artifact) the sync fills it over several runs: every run
 *   fetches for at most {@link DTP_PIPELINE_DETAIL_BUDGET_MINUTES} minutes and keeps its progress, so a
 *   job timeout can never throw away hours of downloads. Until the cache is complete enough,
 *   `extract:dtp` leaves the datasets out and compare skips them.
 * - DtP is an extra source: when it fails, the other datasets still run and deploy.
 */

/** Files of `.cache/dtp` the next run needs (listed in the workflow upload); research folders stay out. */
export const DTP_CACHE_ARTIFACT_FILES = [
  DTP_INVENTORY_FILE,
  DTP_AREAS_FILE,
  DTP_DOWNLOAD_METADATA,
  DTP_CATEGORIES_FILE,
  DTP_ORGANIZATIONS_FILE,
  DTP_LICENSES_FILE,
  DTP_GEOMETRY_SOURCES_FILE,
] as const

/**
 * Detail fetch budget per nightly run. A routine run needs 1–3 minutes; filling an empty cache
 * (~25,000 areas at ~0.3 s each) takes about three runs.
 */
export const DTP_PIPELINE_DETAIL_BUDGET_MINUTES = 60

/** Arguments for `download:dtp` in the pipeline: no count cap, bounded by time instead. */
export function dtpPipelineDownloadArgs(): string[] {
  return ['--full', '--max-minutes', String(DTP_PIPELINE_DETAIL_BUDGET_MINUTES)]
}

/** The files `extract:dtp` reads are all present (they may still be incomplete). */
export function dtpCacheReady(runtimeRoot: string): boolean {
  const dir = join(runtimeRoot, DTP_CACHE_DIR)
  return [
    DTP_INVENTORY_FILE,
    DTP_AREAS_FILE,
    DTP_DOWNLOAD_METADATA,
    DTP_CATEGORIES_FILE,
    DTP_ORGANIZATIONS_FILE,
  ].every((file) => existsSync(join(dir, file)))
}

/**
 * The cache was synced within `maxAgeMs` (its `downloadedAt`). The workflow repeats the whole
 * download phase when another source failed; the repeat then skips a DtP sync that already ran.
 */
export function dtpSyncedWithin(runtimeRoot: string, maxAgeMs: number, now = Date.now()): boolean {
  try {
    const raw = JSON.parse(
      readFileSync(join(runtimeRoot, DTP_CACHE_DIR, DTP_DOWNLOAD_METADATA), 'utf8'),
    ) as { downloadedAt?: unknown }
    const at = typeof raw.downloadedAt === 'string' ? Date.parse(raw.downloadedAt) : Number.NaN
    return Number.isFinite(at) && now - at >= 0 && now - at <= maxAgeMs
  } catch {
    return false
  }
}

/** The dataset's official side comes from DtP (`officialProfile: "dtp_protected_areas"`). */
export function isDtpArea(workspaceRoot: string, area: string): boolean {
  return (
    areaHasCompareConfig(workspaceRoot, area) &&
    loadAreaConfig(workspaceRoot, area).officialMode === 'dtp'
  )
}
