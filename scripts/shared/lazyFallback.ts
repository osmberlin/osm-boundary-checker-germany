import { cpSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { BKG_CACHE_DIR, BKG_DOWNLOAD_METADATA } from './bkg.ts'
import { discoverBkgAreaFolderNames } from './bkgAreas.ts'
import { bkgDownloadMetadataSchema } from './bkgDownloadMetadata.ts'
import {
  OFFICIAL_SOURCE_RELATIVE_PATH,
  SOURCE_METADATA_RELATIVE_PATH,
  datasetFolderPath,
} from './datasetPaths.ts'
import {
  GERMANY_OSM_ADMIN_CANDIDATES_FGB_BASENAME,
  GERMANY_OSM_CACHE_DIR,
  GERMANY_OSM_PLZ_CANDIDATES_FGB_BASENAME,
  GERMANY_OSM_SHARED_FGB_BASENAME,
  GERMANY_OSM_SHARED_PLZ_FGB_BASENAME,
} from './germanyOsmPbf.ts'

export function officialSourceNeedsFallback(runtimeRoot: string, area: string): boolean {
  const areaRoot = datasetFolderPath(runtimeRoot, area)
  const officialGeometry = join(areaRoot, OFFICIAL_SOURCE_RELATIVE_PATH)
  const sourceMetadata = join(areaRoot, SOURCE_METADATA_RELATIVE_PATH)
  return !existsSync(officialGeometry) || !existsSync(sourceMetadata)
}

function bkgCacheReady(runtimeRoot: string): boolean {
  const metaPath = join(runtimeRoot, BKG_CACHE_DIR, BKG_DOWNLOAD_METADATA)
  if (!existsSync(metaPath)) return false
  try {
    const meta = bkgDownloadMetadataSchema.parse(JSON.parse(readFileSync(metaPath, 'utf-8')))
    return existsSync(resolve(runtimeRoot, meta.gpkgRelativePath))
  } catch {
    return false
  }
}

export function allBkgOfficialSourcesPresent(workspaceRoot: string, runtimeRoot: string): boolean {
  const areas = discoverBkgAreaFolderNames(workspaceRoot)
  if (areas.length === 0) return false
  return areas.every((area) => !officialSourceNeedsFallback(runtimeRoot, area))
}

/** Skip BKG extract when fallback already restored compare-ready official sources. */
export function shouldSkipBkgExtract(workspaceRoot: string, runtimeRoot: string): boolean {
  if (bkgCacheReady(runtimeRoot)) return false
  return allBkgOfficialSourcesPresent(workspaceRoot, runtimeRoot)
}

function copyTreeIfExists(src: string, dest: string): boolean {
  if (!existsSync(src)) return false
  mkdirSync(join(dest, '..'), { recursive: true })
  cpSync(src, dest, { recursive: true, force: true })
  return true
}

export function resolveFallbackRuntimeRoot(workspaceRoot: string): string | null {
  const fromEnv = process.env.FALLBACK_RUNTIME_ROOT?.trim()
  if (fromEnv) return fromEnv
  const defaultRoot = join(workspaceRoot, '.previous-artifact', '.artifact-runtime')
  return existsSync(defaultRoot) ? defaultRoot : null
}

function firstExistingPath(candidates: string[]): string | null {
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return null
}

export function restoreBkgCacheFromFallback(
  runtimeRoot: string,
  fallbackRuntimeRoot: string,
): boolean {
  const source = firstExistingPath([
    // Current compare-ready scoped cache layout.
    join(fallbackRuntimeRoot, 'scopes', 'source-cache-bkg', BKG_CACHE_DIR),
    join(fallbackRuntimeRoot, 'source-cache-bkg', BKG_CACHE_DIR),
    join(fallbackRuntimeRoot, '.artifact-runtime', 'scopes', 'source-cache-bkg', BKG_CACHE_DIR),
    join(fallbackRuntimeRoot, '.artifact-runtime', 'source-cache-bkg', BKG_CACHE_DIR),
    // Legacy full runtime fallback.
    join(fallbackRuntimeRoot, BKG_CACHE_DIR),
  ])
  if (!source) return false
  return copyTreeIfExists(source, join(runtimeRoot, BKG_CACHE_DIR))
}

export function osmSharedExtractOutputReady(
  runtimeRoot: string,
  kind: 'admin' | 'plz' | 'admin_candidates' | 'plz_candidates',
): boolean {
  const osmCacheDir = join(runtimeRoot, GERMANY_OSM_CACHE_DIR)
  const basenameByKind = {
    admin: GERMANY_OSM_SHARED_FGB_BASENAME,
    plz: GERMANY_OSM_SHARED_PLZ_FGB_BASENAME,
    admin_candidates: GERMANY_OSM_ADMIN_CANDIDATES_FGB_BASENAME,
    plz_candidates: GERMANY_OSM_PLZ_CANDIDATES_FGB_BASENAME,
  } as const
  return existsSync(join(osmCacheDir, basenameByKind[kind]))
}

function osmFallbackCacheHasCompareReadyInputs(runtimeRoot: string): boolean {
  return (
    osmSharedExtractOutputReady(runtimeRoot, 'admin') ||
    osmSharedExtractOutputReady(runtimeRoot, 'plz')
  )
}

export function restoreOsmCacheFromFallback(
  runtimeRoot: string,
  fallbackRuntimeRoot: string,
): boolean {
  const source = firstExistingPath([
    // Artifact zip root when source-cache-osm is downloaded to FALLBACK_RUNTIME_ROOT.
    join(fallbackRuntimeRoot, GERMANY_OSM_CACHE_DIR),
    // Current compare-ready scoped cache layout.
    join(fallbackRuntimeRoot, 'scopes', 'source-cache-osm', GERMANY_OSM_CACHE_DIR),
    join(fallbackRuntimeRoot, 'source-cache-osm', GERMANY_OSM_CACHE_DIR),
    join(
      fallbackRuntimeRoot,
      '.artifact-runtime',
      'scopes',
      'source-cache-osm',
      GERMANY_OSM_CACHE_DIR,
    ),
    join(fallbackRuntimeRoot, '.artifact-runtime', 'source-cache-osm', GERMANY_OSM_CACHE_DIR),
  ])
  if (!source) return false
  if (!copyTreeIfExists(source, join(runtimeRoot, GERMANY_OSM_CACHE_DIR))) return false
  return osmFallbackCacheHasCompareReadyInputs(runtimeRoot)
}

export function restoreOfficialSourceFromFallback(
  runtimeRoot: string,
  fallbackRuntimeRoot: string,
  area: string,
): boolean {
  const source = firstExistingPath([
    // Artifact zip root when source-cache-official is downloaded to FALLBACK_RUNTIME_ROOT.
    join(fallbackRuntimeRoot, 'datasets', area, 'source'),
    // Current compare-ready scoped cache layout.
    join(fallbackRuntimeRoot, 'scopes', 'source-cache-official', 'datasets', area, 'source'),
    join(fallbackRuntimeRoot, 'source-cache-official', 'datasets', area, 'source'),
    join(
      fallbackRuntimeRoot,
      '.artifact-runtime',
      'scopes',
      'source-cache-official',
      'datasets',
      area,
      'source',
    ),
    join(
      fallbackRuntimeRoot,
      '.artifact-runtime',
      'source-cache-official',
      'datasets',
      area,
      'source',
    ),
    // Legacy full runtime fallback.
    join(datasetFolderPath(fallbackRuntimeRoot, area), 'source'),
  ])
  if (!source) return false
  const dest = join(datasetFolderPath(runtimeRoot, area), 'source')
  if (!copyTreeIfExists(source, dest)) return false
  return existsSync(join(dest, 'official.fgb'))
}

export function restoreCompareOutputFromFallback(
  runtimeRoot: string,
  fallbackRuntimeRoot: string,
  area: string,
): boolean {
  const areaRuntime = datasetFolderPath(runtimeRoot, area)
  const outputSource = firstExistingPath([
    // Current compare-ready scoped cache layout.
    join(fallbackRuntimeRoot, 'scopes', 'compare-outputs', 'datasets', area, 'output'),
    join(fallbackRuntimeRoot, 'compare-outputs', 'datasets', area, 'output'),
    join(
      fallbackRuntimeRoot,
      '.artifact-runtime',
      'scopes',
      'compare-outputs',
      'datasets',
      area,
      'output',
    ),
    join(fallbackRuntimeRoot, '.artifact-runtime', 'compare-outputs', 'datasets', area, 'output'),
    // Slim report-runtime artifact layout.
    join(fallbackRuntimeRoot, '.artifact-runtime-report', 'datasets', area, 'output'),
    // Legacy full runtime fallback.
    join(datasetFolderPath(fallbackRuntimeRoot, area), 'output'),
  ])
  const snapshotsSource = firstExistingPath([
    join(fallbackRuntimeRoot, 'scopes', 'compare-outputs', 'datasets', area, 'snapshots.json'),
    join(fallbackRuntimeRoot, 'compare-outputs', 'datasets', area, 'snapshots.json'),
    join(
      fallbackRuntimeRoot,
      '.artifact-runtime',
      'scopes',
      'compare-outputs',
      'datasets',
      area,
      'snapshots.json',
    ),
    join(
      fallbackRuntimeRoot,
      '.artifact-runtime',
      'compare-outputs',
      'datasets',
      area,
      'snapshots.json',
    ),
    // Slim report-runtime artifact layout.
    join(fallbackRuntimeRoot, '.artifact-runtime-report', 'datasets', area, 'snapshots.json'),
    join(datasetFolderPath(fallbackRuntimeRoot, area), 'snapshots.json'),
  ])
  const restoredOutput = outputSource
    ? copyTreeIfExists(outputSource, join(areaRuntime, 'output'))
    : false
  const restoredSnapshots = snapshotsSource
    ? copyTreeIfExists(snapshotsSource, join(areaRuntime, 'snapshots.json'))
    : false
  return restoredOutput || restoredSnapshots
}

export function readCompareGeneratedAt(runtimeRoot: string, area: string): string | null {
  const tablePath = join(datasetFolderPath(runtimeRoot, area), 'output', 'comparison_table.json')
  if (!existsSync(tablePath)) return null
  try {
    const parsed = JSON.parse(readFileSync(tablePath, 'utf-8')) as { generatedAt?: unknown }
    return typeof parsed.generatedAt === 'string' ? parsed.generatedAt : null
  } catch {
    return null
  }
}
