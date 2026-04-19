import { existsSync } from 'node:fs'
import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { DATASETS_DIRECTORY } from '../scripts/shared/datasetPaths.ts'
import { assertDatasetsRootExists, resolveRuntimeRoot } from './runtimeDataRoot.ts'

const runtimeRoot = resolveRuntimeRoot()
const srcDatasetsRoot = assertDatasetsRootExists(runtimeRoot, 'prepare-static-snapshot')
const destPublicRoot = join(import.meta.dir, 'public')
const destDatasetsRoot = join(destPublicRoot, DATASETS_DIRECTORY)
const destDataRoot = join(destPublicRoot, 'data')

async function copyIfExists(src: string, dest: string): Promise<boolean> {
  if (!existsSync(src)) return false
  await mkdir(resolve(dest, '..'), { recursive: true })
  const srcStat = await stat(src)
  await cp(src, dest, { recursive: srcStat.isDirectory(), force: true })
  return true
}

async function main() {
  const areaEntries = await readdir(srcDatasetsRoot, { withFileTypes: true })
  const areaFolders = areaEntries.filter(
    (entry) => entry.isDirectory() && !entry.name.startsWith('.'),
  )
  if (areaFolders.length === 0) {
    throw new Error(
      `[prepare-static-snapshot] No area folders found under ${srcDatasetsRoot}. Did you run the processing pipeline?`,
    )
  }

  await rm(destDatasetsRoot, { recursive: true, force: true })
  await rm(destDataRoot, { recursive: true, force: true })

  let comparisonTableCount = 0
  for (const entry of areaFolders) {
    const area = entry.name
    const areaSrc = join(srcDatasetsRoot, area)
    const areaDest = join(destDatasetsRoot, area)
    await copyIfExists(join(areaSrc, 'snapshots.json'), join(areaDest, 'snapshots.json'))
    await copyIfExists(
      join(areaSrc, 'output', 'comparison.pmtiles'),
      join(areaDest, 'output', 'comparison.pmtiles'),
    )
    await copyIfExists(
      join(areaSrc, 'output', 'unmatched.pmtiles'),
      join(areaDest, 'output', 'unmatched.pmtiles'),
    )
    if (
      await copyIfExists(
        join(areaSrc, 'output', 'comparison_table.json'),
        join(areaDest, 'output', 'comparison_table.json'),
      )
    ) {
      comparisonTableCount += 1
    }
    await copyIfExists(
      join(areaSrc, 'output', 'unmatched.json'),
      join(areaDest, 'output', 'unmatched.json'),
    )
    await copyIfExists(join(areaSrc, 'output', 'features'), join(areaDest, 'output', 'features'))
    await copyIfExists(
      join(areaSrc, 'output', 'official_for_edit'),
      join(areaDest, 'output', 'official_for_edit'),
    )
  }

  if (comparisonTableCount === 0) {
    throw new Error(
      `[prepare-static-snapshot] No output/comparison_table.json files found under ${srcDatasetsRoot}. Refusing to publish an empty report.`,
    )
  }

  await copyIfExists(
    join(runtimeRoot, 'data', 'processing-state.json'),
    join(destDataRoot, 'processing-state.json'),
  )
  await copyIfExists(
    join(runtimeRoot, 'data', 'processing-log.jsonl'),
    join(destDataRoot, 'processing-log.jsonl'),
  )

  console.log(
    `[prepare-static-snapshot] Wrote public datasets from ${runtimeRoot} (${comparisonTableCount} areas with comparison_table.json)`,
  )
}

void main().catch((err) => {
  console.error(err)
  process.exit(1)
})
