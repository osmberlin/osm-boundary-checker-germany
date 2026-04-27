import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const reportArtifactRoot = path.resolve('.artifact-runtime-report')
const reportArtifactDatasets = path.join(reportArtifactRoot, 'datasets')
const reportArtifactData = path.join(reportArtifactRoot, 'data')
const datasetsRoot = path.resolve('datasets')
const dataRoot = path.resolve('data')

type ReportArtifactSummary = {
  generatedAt: string
  areasIncluded: string[]
  comparisonTableCount: number
  copiedDataFiles: string[]
}

function ensureParent(filePath: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true })
}

function copyFileIfExists(source: string, destination: string): boolean {
  if (!existsSync(source)) return false
  ensureParent(destination)
  cpSync(source, destination, { force: true })
  return true
}

function copyDirectoryIfExists(source: string, destination: string): boolean {
  if (!existsSync(source)) return false
  ensureParent(destination)
  cpSync(source, destination, { recursive: true, force: true })
  return true
}

rmSync(reportArtifactRoot, { recursive: true, force: true })
mkdirSync(reportArtifactDatasets, { recursive: true })
mkdirSync(reportArtifactData, { recursive: true })

if (!existsSync(datasetsRoot)) {
  throw new Error(`[stage-report-runtime-artifact] Missing datasets directory at ${datasetsRoot}`)
}

const copiedAreas: string[] = []
let comparisonTableCount = 0
for (const entry of readdirSync(datasetsRoot, { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name.startsWith('.')) continue
  const area = entry.name
  const areaSrc = path.join(datasetsRoot, area)
  const areaDest = path.join(reportArtifactDatasets, area)

  copyFileIfExists(path.join(areaSrc, 'snapshots.json'), path.join(areaDest, 'snapshots.json'))
  copyFileIfExists(
    path.join(areaSrc, 'output', 'comparison.pmtiles'),
    path.join(areaDest, 'output', 'comparison.pmtiles'),
  )
  copyFileIfExists(
    path.join(areaSrc, 'output', 'unmatched.pmtiles'),
    path.join(areaDest, 'output', 'unmatched.pmtiles'),
  )
  if (
    copyFileIfExists(
      path.join(areaSrc, 'output', 'comparison_table.json'),
      path.join(areaDest, 'output', 'comparison_table.json'),
    )
  ) {
    comparisonTableCount += 1
  }
  copyDirectoryIfExists(
    path.join(areaSrc, 'output', 'features'),
    path.join(areaDest, 'output', 'features'),
  )
  copyDirectoryIfExists(
    path.join(areaSrc, 'output', 'official_for_edit'),
    path.join(areaDest, 'output', 'official_for_edit'),
  )
  copiedAreas.push(area)
}

if (comparisonTableCount === 0) {
  throw new Error(
    '[stage-report-runtime-artifact] No output/comparison_table.json files found; refusing to stage empty deploy artifact.',
  )
}

const copiedDataFiles: string[] = []
for (const dataFile of ['processing-state.json', 'processing-log.jsonl', 'run-status.json']) {
  const copied = copyFileIfExists(
    path.join(dataRoot, dataFile),
    path.join(reportArtifactData, dataFile),
  )
  if (copied) copiedDataFiles.push(dataFile)
}

const summary: ReportArtifactSummary = {
  generatedAt: new Date().toISOString(),
  areasIncluded: copiedAreas.sort(),
  comparisonTableCount,
  copiedDataFiles,
}
writeFileSync(
  path.join(reportArtifactRoot, 'report-runtime-index.json'),
  `${JSON.stringify(summary, null, 2)}\n`,
  { encoding: 'utf-8' },
)

console.log(
  `[stage-report-runtime-artifact] Staged ${copiedAreas.length} areas (${comparisonTableCount} with comparison_table.json).`,
)
