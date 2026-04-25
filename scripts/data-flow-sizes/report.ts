import { existsSync } from 'node:fs'
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { DATASETS_DIRECTORY } from '../shared/datasetPaths.ts'
import { runtimeRootFromWorkspace } from '../shared/runtimeRoot.ts'
import { workspaceRootFromHere } from '../shared/workspaceRoot.ts'

type SizedFile = {
  absPath: string
  relPath: string
  bytes: number
}

type Rule = {
  pattern: string
  behavior: 'preserved' | 'removed_or_ephemeral' | 'copied_to_public' | 'not_copied_to_public'
  why: string
}

const OBSOLETE_OUTPUT_FILES = new Set([
  'output/comparison_for_report.json',
  'output/detailed_results.csv',
  'output/comparison_report.md',
])

const WRITE_OUTPUTS_RULES: Rule[] = [
  {
    pattern: 'snapshots.json',
    behavior: 'preserved',
    why: 'updated/merged on each compare run to keep historical summaries',
  },
  {
    pattern: 'output/comparison_table.json',
    behavior: 'preserved',
    why: 'main area payload consumed by report area page',
  },
  {
    pattern: 'output/features/*.json',
    behavior: 'preserved',
    why: 'feature-level API shards for detail route',
  },
  {
    pattern: 'output/official_for_edit/*.geojson',
    behavior: 'preserved',
    why: 'official geometry exports for edit/download',
  },
  {
    pattern: 'output/comparison.pmtiles',
    behavior: 'preserved',
    why: 'comparison map layer used by MapLibre via PMTiles',
  },
  {
    pattern: 'output/unmatched.pmtiles',
    behavior: 'preserved',
    why: 'unmatched layer used by MapLibre via PMTiles',
  },
  {
    pattern: 'output/_build/geometries.fgb',
    behavior: 'removed_or_ephemeral',
    why: 'temporary Tippecanoe input removed after pmtiles generation',
  },
  {
    pattern: 'output/_build/unmatched.fgb',
    behavior: 'removed_or_ephemeral',
    why: 'temporary Tippecanoe input removed after pmtiles generation',
  },
  {
    pattern: 'output/_build/',
    behavior: 'removed_or_ephemeral',
    why: 'build staging directory is cleaned up after run',
  },
  {
    pattern: 'output/comparison_for_report.json',
    behavior: 'removed_or_ephemeral',
    why: 'legacy output deleted when present',
  },
  {
    pattern: 'output/detailed_results.csv',
    behavior: 'removed_or_ephemeral',
    why: 'legacy output deleted when present',
  },
  {
    pattern: 'output/comparison_report.md',
    behavior: 'removed_or_ephemeral',
    why: 'legacy output deleted when present',
  },
]

const PREPARE_SNAPSHOT_RULES: Rule[] = [
  {
    pattern: 'snapshots.json',
    behavior: 'copied_to_public',
    why: 'loaded by area route snapshots query',
  },
  {
    pattern: 'output/comparison.pmtiles',
    behavior: 'copied_to_public',
    why: 'map source for comparison layer',
  },
  {
    pattern: 'output/unmatched.pmtiles',
    behavior: 'copied_to_public',
    why: 'map source for unmatched layer',
  },
  {
    pattern: 'output/comparison_table.json',
    behavior: 'copied_to_public',
    why: 'primary area payload fetched by report',
  },
  {
    pattern: 'output/features/',
    behavior: 'copied_to_public',
    why: 'feature route payload shards',
  },
  {
    pattern: 'output/official_for_edit/',
    behavior: 'copied_to_public',
    why: 'downloadable official geometries referenced by rows',
  },
  {
    pattern: 'data/processing-state.json',
    behavior: 'copied_to_public',
    why: 'status page processing summary input',
  },
  {
    pattern: 'data/processing-log.jsonl',
    behavior: 'copied_to_public',
    why: 'status page log stream input',
  },
  {
    pattern: 'everything else under datasets/<area>',
    behavior: 'not_copied_to_public',
    why: 'prepareStaticSnapshot copies only explicit allowlisted files/dirs',
  },
]

function formatMiB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`
}

function sumBytes(rows: SizedFile[]): number {
  return rows.reduce((acc, row) => acc + row.bytes, 0)
}

function topRows(rows: SizedFile[], count = 12): SizedFile[] {
  return [...rows].sort((a, b) => b.bytes - a.bytes).slice(0, count)
}

function areaFromRelPath(relPath: string): string {
  const [first] = relPath.split('/')
  return first ?? '(unknown)'
}

function classifyRuntimeDatasetPath(relPath: string): string {
  const parts = relPath.split('/')
  const area = parts[0]
  const areaRel = parts.slice(1).join('/')
  if (!area || !areaRel) return 'other'
  if (areaRel === 'snapshots.json') return 'snapshots'
  if (areaRel === 'output/comparison_table.json') return 'comparison_table_json'
  if (areaRel === 'output/comparison.pmtiles') return 'comparison_pmtiles'
  if (areaRel === 'output/unmatched.pmtiles') return 'unmatched_pmtiles'
  if (areaRel.startsWith('output/features/')) return 'feature_shards'
  if (areaRel.startsWith('output/official_for_edit/')) return 'official_for_edit'
  if (areaRel.startsWith('output/_build/')) return 'ephemeral_build'
  if (OBSOLETE_OUTPUT_FILES.has(areaRel)) return 'obsolete_legacy'
  return 'other_internal_or_source'
}

async function safeWalk(root: string): Promise<SizedFile[]> {
  if (!existsSync(root)) return []
  const out: SizedFile[] = []
  const entries = await readdir(root, { withFileTypes: true })
  for (const entry of entries) {
    const absPath = join(root, entry.name)
    if (entry.isDirectory()) {
      out.push(...(await safeWalk(absPath)))
      continue
    }
    if (!entry.isFile()) continue
    const info = await stat(absPath)
    out.push({ absPath, relPath: '', bytes: info.size })
  }
  return out
}

async function safeStat(path: string): Promise<number | null> {
  try {
    const info = await stat(path)
    if (!info.isFile()) return null
    return info.size
  } catch {
    return null
  }
}

function addSectionLine(
  lines: string[],
  label: string,
  bytes: number | null,
  relPath: string,
): number {
  if (bytes == null) {
    lines.push(`- ${label}: \`${relPath}\` - missing`)
    return 0
  }
  lines.push(`- ${label}: \`${relPath}\` - ${formatMiB(bytes)} (${bytes} bytes)`)
  return bytes
}

async function listAreas(datasetsRoot: string): Promise<string[]> {
  if (!existsSync(datasetsRoot)) return []
  const entries = await readdir(datasetsRoot, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
}

function printRuleTable(lines: string[], title: string, rules: Rule[]): void {
  lines.push(`## ${title}`)
  lines.push('')
  lines.push('| Pattern | Behavior | Why |')
  lines.push('| --- | --- | --- |')
  for (const rule of rules) {
    lines.push(`| \`${rule.pattern}\` | ${rule.behavior} | ${rule.why} |`)
  }
  lines.push('')
}

async function main() {
  const workspaceRoot = workspaceRootFromHere(import.meta.url)
  const runtimeRoot = runtimeRootFromWorkspace(workspaceRoot)
  const runtimeDatasetsRoot = join(runtimeRoot, DATASETS_DIRECTORY)
  const runtimeDataRoot = join(runtimeRoot, 'data')

  const reportPublicRoot = join(workspaceRoot, 'report', 'public')
  const publicDatasetsRoot = join(reportPublicRoot, DATASETS_DIRECTORY)
  const publicDataRoot = join(reportPublicRoot, 'data')
  const distRoot = join(workspaceRoot, 'report', 'dist')

  const reportOutPath = join(workspaceRoot, 'scripts', 'data-flow-sizes', 'report.md')
  const lines: string[] = []

  lines.push('# Data flow size report')
  lines.push('')
  lines.push(`Generated: ${new Date().toISOString()}`)
  lines.push(`Workspace root: \`${workspaceRoot}\``)
  lines.push(`Runtime root: \`${runtimeRoot}\``)
  lines.push('')

  const runtimeFilesRaw = await safeWalk(runtimeDatasetsRoot)
  const runtimeFiles = runtimeFilesRaw.map((row) => ({
    ...row,
    relPath: relative(runtimeDatasetsRoot, row.absPath),
  }))

  lines.push('## Runtime processing footprint (`datasets/...`)')
  lines.push('')
  lines.push(`- Total files: **${runtimeFiles.length}**`)
  lines.push(`- Total size: **${formatMiB(sumBytes(runtimeFiles))}**`)
  lines.push('')

  const byCategory = new Map<string, { files: number; bytes: number }>()
  for (const file of runtimeFiles) {
    const category = classifyRuntimeDatasetPath(file.relPath)
    const bucket = byCategory.get(category) ?? { files: 0, bytes: 0 }
    bucket.files += 1
    bucket.bytes += file.bytes
    byCategory.set(category, bucket)
  }
  lines.push('### Runtime categories')
  lines.push('')
  lines.push('| Category | Files | Size |')
  lines.push('| --- | ---: | ---: |')
  for (const [category, bucket] of [...byCategory.entries()].sort(
    (a, b) => b[1].bytes - a[1].bytes,
  )) {
    lines.push(`| ${category} | ${bucket.files} | ${formatMiB(bucket.bytes)} |`)
  }
  lines.push('')

  lines.push('### Largest runtime files (global)')
  lines.push('')
  for (const row of topRows(runtimeFiles, 20)) {
    lines.push(
      `- \`${join(DATASETS_DIRECTORY, row.relPath)}\` - ${formatMiB(row.bytes)} (${row.bytes} bytes)`,
    )
  }
  lines.push('')

  const areas = await listAreas(runtimeDatasetsRoot)
  lines.push('### Per-area runtime totals')
  lines.push('')
  lines.push('| Area | Files | Size |')
  lines.push('| --- | ---: | ---: |')
  for (const area of areas) {
    const files = runtimeFiles.filter((row) => areaFromRelPath(row.relPath) === area)
    lines.push(`| ${area} | ${files.length} | ${formatMiB(sumBytes(files))} |`)
  }
  lines.push('')

  printRuleTable(lines, 'Action rules from compare output generation', WRITE_OUTPUTS_RULES)
  printRuleTable(lines, 'Action rules from static snapshot copy step', PREPARE_SNAPSHOT_RULES)

  const publicDatasetFilesRaw = await safeWalk(publicDatasetsRoot)
  const publicDatasetFiles = publicDatasetFilesRaw.map((row) => ({
    ...row,
    relPath: relative(publicDatasetsRoot, row.absPath),
  }))
  const publicDataFilesRaw = await safeWalk(publicDataRoot)
  const publicDataFiles = publicDataFilesRaw.map((row) => ({
    ...row,
    relPath: relative(publicDataRoot, row.absPath),
  }))

  lines.push('## Public snapshot footprint (`report/public`)')
  lines.push('')
  lines.push(
    `- Datasets files: **${publicDatasetFiles.length}** (${formatMiB(sumBytes(publicDatasetFiles))})`,
  )
  lines.push(
    `- Data files: **${publicDataFiles.length}** (${formatMiB(sumBytes(publicDataFiles))})`,
  )
  lines.push('')
  lines.push('Largest public dataset files:')
  lines.push('')
  for (const row of topRows(publicDatasetFiles, 16)) {
    lines.push(
      `- \`${join('report', 'public', DATASETS_DIRECTORY, row.relPath)}\` - ${formatMiB(row.bytes)} (${row.bytes} bytes)`,
    )
  }
  lines.push('')

  if (existsSync(distRoot)) {
    const distFiles = await safeWalk(distRoot)
    lines.push('## Built static artifact footprint (`report/dist`)')
    lines.push('')
    lines.push(`- Files: **${distFiles.length}**`)
    lines.push(`- Size: **${formatMiB(sumBytes(distFiles))}**`)
    lines.push('')
  }

  lines.push('## User-facing route load estimates')
  lines.push('')
  lines.push(
    'These estimates use file size on disk. Real transfer can be lower due to compression; PMTiles is range-requested.',
  )
  lines.push('')

  const statusStateBytes = await safeStat(join(publicDataRoot, 'processing-state.json'))
  const statusLogBytes = await safeStat(join(publicDataRoot, 'processing-log.jsonl'))
  const runtimeStateBytes = await safeStat(join(runtimeDataRoot, 'processing-state.json'))
  const runtimeLogBytes = await safeStat(join(runtimeDataRoot, 'processing-log.jsonl'))

  lines.push('### Shared routes')
  lines.push('')
  lines.push('#### `/`')
  lines.push('')
  const routeRootTotal = 0
  lines.push('- no additional route-specific static payload')
  lines.push(`- Route estimate total: **${formatMiB(routeRootTotal)} (${routeRootTotal} bytes)**`)
  lines.push('')

  lines.push('#### `/status`')
  lines.push('')
  let statusTotal = 0
  statusTotal += addSectionLine(
    lines,
    'processing-state (public first, runtime fallback)',
    statusStateBytes ?? runtimeStateBytes,
    statusStateBytes != null
      ? relative(workspaceRoot, join(publicDataRoot, 'processing-state.json'))
      : relative(workspaceRoot, join(runtimeDataRoot, 'processing-state.json')),
  )
  statusTotal += addSectionLine(
    lines,
    'processing-log (public first, runtime fallback)',
    statusLogBytes ?? runtimeLogBytes,
    statusLogBytes != null
      ? relative(workspaceRoot, join(publicDataRoot, 'processing-log.jsonl'))
      : relative(workspaceRoot, join(runtimeDataRoot, 'processing-log.jsonl')),
  )
  lines.push(`- Route estimate total: **${formatMiB(statusTotal)} (${statusTotal} bytes)**`)
  lines.push('')

  for (const area of areas) {
    const sourceRoot = existsSync(join(publicDatasetsRoot, area))
      ? publicDatasetsRoot
      : runtimeDatasetsRoot
    const sourceLabel = sourceRoot === publicDatasetsRoot ? 'public snapshot' : 'runtime datasets'
    const areaComparisonPath = join(sourceRoot, area, 'output', 'comparison_table.json')
    const areaSnapshotsPath = join(sourceRoot, area, 'snapshots.json')
    const areaComparisonPmtilesPath = join(sourceRoot, area, 'output', 'comparison.pmtiles')
    const areaUnmatchedPmtilesPath = join(sourceRoot, area, 'output', 'unmatched.pmtiles')
    const areaFeatureDir = join(sourceRoot, area, 'output', 'features')

    const areaComparisonBytes = await safeStat(areaComparisonPath)
    const areaSnapshotsBytes = await safeStat(areaSnapshotsPath)
    const areaComparisonPmtilesBytes = await safeStat(areaComparisonPmtilesPath)
    const areaUnmatchedPmtilesBytes = await safeStat(areaUnmatchedPmtilesPath)

    let featureFiles = (await safeWalk(areaFeatureDir)).map((row) => ({
      ...row,
      relPath: relative(workspaceRoot, row.absPath),
    }))
    featureFiles = featureFiles.sort((a, b) => a.bytes - b.bytes)
    const featureLargest = featureFiles[featureFiles.length - 1] ?? null
    const featureMedian =
      featureFiles.length > 0 ? featureFiles[Math.floor((featureFiles.length - 1) / 2)] : null

    lines.push(`### Dataset \`${area}\` (${sourceLabel})`)
    lines.push('')

    lines.push(`#### \`/${area}\``)
    lines.push('')
    let areaRouteTotal = 0
    areaRouteTotal += addSectionLine(
      lines,
      'comparison table',
      areaComparisonBytes,
      relative(workspaceRoot, areaComparisonPath),
    )
    areaRouteTotal += addSectionLine(
      lines,
      'snapshots',
      areaSnapshotsBytes,
      relative(workspaceRoot, areaSnapshotsPath),
    )
    areaRouteTotal += addSectionLine(
      lines,
      'comparison pmtiles (range requested)',
      areaComparisonPmtilesBytes,
      relative(workspaceRoot, areaComparisonPmtilesPath),
    )
    areaRouteTotal += addSectionLine(
      lines,
      'unmatched pmtiles (range requested)',
      areaUnmatchedPmtilesBytes,
      relative(workspaceRoot, areaUnmatchedPmtilesPath),
    )
    lines.push(`- Route estimate total: **${formatMiB(areaRouteTotal)} (${areaRouteTotal} bytes)**`)
    lines.push('')

    lines.push(`#### \`/${area}/feature/{featureKey}\``)
    lines.push('')
    let featureRouteLargestTotal = 0
    featureRouteLargestTotal += addSectionLine(
      lines,
      'largest feature shard',
      featureLargest?.bytes ?? null,
      featureLargest?.relPath ?? '(no feature shard found)',
    )
    featureRouteLargestTotal += addSectionLine(
      lines,
      'comparison fallback payload',
      areaComparisonBytes,
      relative(workspaceRoot, areaComparisonPath),
    )
    lines.push(
      `- Route estimate total (largest shard + fallback upper bound): **${formatMiB(featureRouteLargestTotal)} (${featureRouteLargestTotal} bytes)**`,
    )
    lines.push('')

    let featureRouteMedianTotal = 0
    featureRouteMedianTotal += addSectionLine(
      lines,
      'median feature shard',
      featureMedian?.bytes ?? null,
      featureMedian?.relPath ?? '(no feature shard found)',
    )
    lines.push(
      `- Route estimate total (median shard, no fallback): **${formatMiB(featureRouteMedianTotal)} (${featureRouteMedianTotal} bytes)**`,
    )
    lines.push('')
  }

  await mkdir(join(workspaceRoot, 'scripts', 'data-flow-sizes'), { recursive: true })
  await writeFile(reportOutPath, `${lines.join('\n')}\n`, 'utf8')
  console.log(`[data-flow-sizes] Wrote ${reportOutPath}`)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
