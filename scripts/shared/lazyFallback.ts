import { cpSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { BKG_CACHE_DIR } from './bkg.ts'
import { datasetFolderPath } from './datasetPaths.ts'
import { GERMANY_OSM_CACHE_DIR } from './germanyOsmPbf.ts'

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

export function restoreOsmCacheFromFallback(
  runtimeRoot: string,
  fallbackRuntimeRoot: string,
): boolean {
  const source = firstExistingPath([
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
    // Legacy full runtime fallback.
    join(fallbackRuntimeRoot, GERMANY_OSM_CACHE_DIR),
  ])
  if (!source) return false
  return copyTreeIfExists(source, join(runtimeRoot, GERMANY_OSM_CACHE_DIR))
}

export function restoreOfficialSourceFromFallback(
  runtimeRoot: string,
  fallbackRuntimeRoot: string,
  area: string,
): boolean {
  const source = firstExistingPath([
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
  return copyTreeIfExists(source, join(datasetFolderPath(runtimeRoot, area), 'source'))
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
