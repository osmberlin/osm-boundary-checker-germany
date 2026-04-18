import { existsSync } from 'node:fs'
import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { DATASETS_DIRECTORY } from '../scripts/shared/datasetPaths.ts'

const repoRoot = resolve(import.meta.dir, '..')
const runtimeRoot = resolve(process.env.DATA_ROOT?.trim() || repoRoot)
const srcDatasetsRoot = join(runtimeRoot, DATASETS_DIRECTORY)
const destPublicRoot = join(import.meta.dir, 'public')
const destDatasetsRoot = join(destPublicRoot, DATASETS_DIRECTORY)
const destDataRoot = join(destPublicRoot, 'data')

async function copyIfExists(src: string, dest: string): Promise<void> {
  if (!existsSync(src)) return
  await mkdir(resolve(dest, '..'), { recursive: true })
  const srcStat = await stat(src)
  await cp(src, dest, { recursive: srcStat.isDirectory(), force: true })
}

async function main() {
  await rm(destDatasetsRoot, { recursive: true, force: true })
  await rm(destDataRoot, { recursive: true, force: true })

  if (!existsSync(srcDatasetsRoot)) {
    console.warn(`[prepare-static-snapshot] Missing datasets root: ${srcDatasetsRoot}`)
    await mkdir(destDatasetsRoot, { recursive: true })
  } else {
    const areaEntries = await readdir(srcDatasetsRoot, { withFileTypes: true })
    for (const entry of areaEntries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue
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
      await copyIfExists(
        join(areaSrc, 'output', 'comparison_table.json'),
        join(areaDest, 'output', 'comparison_table.json'),
      )
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
  }

  await copyIfExists(
    join(runtimeRoot, 'data', 'processing-state.json'),
    join(destDataRoot, 'processing-state.json'),
  )
  await copyIfExists(
    join(runtimeRoot, 'data', 'processing-log.jsonl'),
    join(destDataRoot, 'processing-log.jsonl'),
  )

  console.log(`[prepare-static-snapshot] Wrote public datasets from ${runtimeRoot}`)
}

void main().catch((err) => {
  console.error(err)
  process.exit(1)
})
