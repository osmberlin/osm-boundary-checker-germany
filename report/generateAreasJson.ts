/**
 * Writes `areas.gen.json` at the repo root (served as `/areas.gen.json` in dev/preview and static deploy).
 * Run via predev/prebuild; commit the file.
 */
import { writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { AREAS_GEN_BASENAME } from './generatedAssets.ts'
import { listComparisonAreas } from './listComparisonAreas.ts'

const repoRoot = resolve(import.meta.dir, '..')
const areas = listComparisonAreas(repoRoot)
const outPath = join(repoRoot, AREAS_GEN_BASENAME)
writeFileSync(outPath, `${JSON.stringify({ areas }, null, 2)}\n`, 'utf8')
console.log(`Wrote ${outPath} (${areas.length} areas)`)
