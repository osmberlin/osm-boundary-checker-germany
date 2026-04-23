/**
 * Writes `areas.gen.json` at the repo root (served as `/areas.gen.json` in dev/preview and static deploy).
 * Run via predev/prebuild; commit the file.
 */
import { writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { AREAS_GEN_BASENAME } from './generatedAssets.ts'
import { listComparisonAreaSummaries, listGeoDataSources } from './listComparisonAreas.ts'
import { resolveRuntimeRoot } from './runtimeDataRoot.ts'

const repoRoot = resolve(import.meta.dir, '..')
const runtimeRoot = resolveRuntimeRoot()
const summaries = listComparisonAreaSummaries(runtimeRoot)
const areas = summaries.map((s) => s.area)
const geoDataSources = listGeoDataSources(runtimeRoot)
const payload = `${JSON.stringify({ areas, summaries, geoDataSources }, null, 2)}\n`
const repoOutPath = join(repoRoot, AREAS_GEN_BASENAME)
const publicOutPath = join(import.meta.dir, 'public', AREAS_GEN_BASENAME)

writeFileSync(repoOutPath, payload, 'utf8')
writeFileSync(publicOutPath, payload, 'utf8')
console.log(
  `Wrote ${repoOutPath} and ${publicOutPath} (${areas.length} areas, DATA_ROOT=${runtimeRoot})`,
)
