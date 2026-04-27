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

export function restoreBkgCacheFromFallback(
  runtimeRoot: string,
  fallbackRuntimeRoot: string,
): boolean {
  return copyTreeIfExists(
    join(fallbackRuntimeRoot, BKG_CACHE_DIR),
    join(runtimeRoot, BKG_CACHE_DIR),
  )
}

export function restoreOsmCacheFromFallback(
  runtimeRoot: string,
  fallbackRuntimeRoot: string,
): boolean {
  return copyTreeIfExists(
    join(fallbackRuntimeRoot, GERMANY_OSM_CACHE_DIR),
    join(runtimeRoot, GERMANY_OSM_CACHE_DIR),
  )
}

export function restoreOfficialSourceFromFallback(
  runtimeRoot: string,
  fallbackRuntimeRoot: string,
  area: string,
): boolean {
  return copyTreeIfExists(
    join(datasetFolderPath(fallbackRuntimeRoot, area), 'source'),
    join(datasetFolderPath(runtimeRoot, area), 'source'),
  )
}

export function restoreCompareOutputFromFallback(
  runtimeRoot: string,
  fallbackRuntimeRoot: string,
  area: string,
): boolean {
  const areaRuntime = datasetFolderPath(runtimeRoot, area)
  const areaFallback = datasetFolderPath(fallbackRuntimeRoot, area)
  const restoredOutput = copyTreeIfExists(join(areaFallback, 'output'), join(areaRuntime, 'output'))
  const restoredSnapshots = copyTreeIfExists(
    join(areaFallback, 'snapshots.json'),
    join(areaRuntime, 'snapshots.json'),
  )
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
