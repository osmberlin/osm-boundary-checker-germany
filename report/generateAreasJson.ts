/**
 * Writes `areas.gen.json` at the repo root (served as `/areas.gen.json` in dev/preview and static deploy).
 * Run via predev/prebuild; commit the file.
 */
import { writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { AREAS_GEN_BASENAME } from './generatedAssets.ts'
import { listComparisonAreaSummaries } from './listComparisonAreas.ts'
import { resolveRuntimeRoot } from './runtimeDataRoot.ts'

const repoRoot = resolve(import.meta.dir, '..')
const runtimeRoot = resolveRuntimeRoot()
const summaries = listComparisonAreaSummaries(runtimeRoot)
const areas = summaries.map((s) => s.area)
const outPath = join(repoRoot, AREAS_GEN_BASENAME)
writeFileSync(outPath, `${JSON.stringify({ areas, summaries }, null, 2)}\n`, 'utf8')
console.log(`Wrote ${outPath} (${areas.length} areas, DATA_ROOT=${runtimeRoot})`)
