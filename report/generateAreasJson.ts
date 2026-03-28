/**
 * Writes `__areas.json` at the repo root (served as `/__areas.json` in dev/preview and static deploy).
 * Run via predev/prebuild; commit the file.
 */
import { writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { listComparisonAreas } from './listComparisonAreas.ts'

const repoRoot = resolve(import.meta.dir, '..')
const areas = listComparisonAreas(repoRoot)
const outPath = join(repoRoot, '__areas.json')
writeFileSync(outPath, `${JSON.stringify({ areas }, null, 2)}\n`, 'utf8')
console.log(`Wrote ${outPath} (${areas.length} areas)`)
