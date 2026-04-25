import { mkdir, readdir, stat, writeFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { DATASETS_DIRECTORY } from '../scripts/shared/datasetPaths.ts'

type SizedPath = { path: string; bytes: number }

const reportRoot = import.meta.dir
const repoRoot = resolve(reportRoot, '..')
const runtimeRoot = resolve(process.env.DATA_ROOT?.trim() || repoRoot)
const datasetsRoot = join(runtimeRoot, DATASETS_DIRECTORY)
const outPath = join(repoRoot, 'analysis', 'out', 'data-size-report.md')

function formatMiB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`
}

async function walkFiles(root: string): Promise<SizedPath[]> {
  const out: SizedPath[] = []
  const entries = await readdir(root, { withFileTypes: true })
  for (const entry of entries) {
    const abs = join(root, entry.name)
    if (entry.isDirectory()) {
      out.push(...(await walkFiles(abs)))
      continue
    }
    if (!entry.isFile()) continue
    const info = await stat(abs)
    out.push({ path: abs, bytes: info.size })
  }
  return out
}

function sum(paths: SizedPath[]): number {
  return paths.reduce((acc, row) => acc + row.bytes, 0)
}

function topRows(rows: SizedPath[], count = 12): SizedPath[] {
  return [...rows].sort((a, b) => b.bytes - a.bytes).slice(0, count)
}

function isUserFacing(pathAbs: string): boolean {
  return (
    pathAbs.includes('/output/comparison.pmtiles') ||
    pathAbs.includes('/output/unmatched.pmtiles') ||
    pathAbs.includes('/output/comparison_table.json') ||
    pathAbs.includes('/output/features/') ||
    pathAbs.includes('/output/official_for_edit/') ||
    pathAbs.endsWith('/snapshots.json')
  )
}

async function main() {
  const lines: string[] = []
  lines.push('# Data size report')
  lines.push('')
  lines.push(`Generated: ${new Date().toISOString()}`)
  lines.push(`Runtime root: \`${runtimeRoot}\``)
  lines.push('')

  const datasetFiles = await walkFiles(datasetsRoot)
  const userFacingFiles = datasetFiles.filter((row) => isUserFacing(row.path))
  const internalFiles = datasetFiles.filter((row) => !isUserFacing(row.path))

  lines.push('## Internal processing footprint')
  lines.push('')
  lines.push(`- Internal files total: **${formatMiB(sum(internalFiles))}**`)
  lines.push(`- Internal file count: **${internalFiles.length}**`)
  lines.push('')
  lines.push('Top internal files:')
  lines.push('')
  for (const row of topRows(internalFiles)) {
    lines.push(
      `- \`${relative(repoRoot, row.path)}\` — ${formatMiB(row.bytes)} (${row.bytes} bytes)`,
    )
  }
  lines.push('')

  lines.push('## User-facing static footprint')
  lines.push('')
  lines.push(`- User-facing files total: **${formatMiB(sum(userFacingFiles))}**`)
  lines.push(`- User-facing file count: **${userFacingFiles.length}**`)
  lines.push('')
  lines.push('Top user-facing files:')
  lines.push('')
  for (const row of topRows(userFacingFiles)) {
    lines.push(
      `- \`${relative(repoRoot, row.path)}\` — ${formatMiB(row.bytes)} (${row.bytes} bytes)`,
    )
  }
  lines.push('')

  const areaList = await readdir(datasetsRoot, { withFileTypes: true })
  const firstArea = areaList.find(
    (entry) => entry.isDirectory() && !entry.name.startsWith('.'),
  )?.name
  if (firstArea) {
    const areaTable = join(datasetsRoot, firstArea, 'output', 'comparison_table.json')
    const areaFeatureDir = join(datasetsRoot, firstArea, 'output', 'features')
    let firstFeature: SizedPath | null = null
    try {
      const featureEntries = await walkFiles(areaFeatureDir)
      firstFeature = topRows(featureEntries, 1)[0] ?? null
    } catch {
      firstFeature = null
    }

    const routes: Array<{ route: string; files: string[] }> = [
      {
        route: `/${firstArea}`,
        files: [areaTable],
      },
      {
        route: `/${firstArea}/feature/{featureKey}`,
        files: [areaTable, firstFeature?.path ?? '(no feature shard found)'],
      },
    ]

    lines.push('## Route load estimates')
    lines.push('')
    lines.push(
      'Estimates below use file sizes on disk and represent upper bounds before HTTP compression and map tile range-requests.',
    )
    lines.push('')
    for (const route of routes) {
      let total = 0
      lines.push(`### ${route.route}`)
      lines.push('')
      for (const filePath of route.files) {
        if (filePath === '(no feature shard found)') {
          lines.push('- no feature shard found')
          continue
        }
        try {
          const info = await stat(filePath)
          total += info.size
          lines.push(
            `- \`${relative(repoRoot, filePath)}\` — ${formatMiB(info.size)} (${info.size} bytes)`,
          )
        } catch {
          lines.push(`- \`${relative(repoRoot, filePath)}\` — missing`)
        }
      }
      lines.push(`- **Route total (estimated): ${formatMiB(total)} (${total} bytes)**`)
      lines.push('')
    }
  }

  await mkdir(join(repoRoot, 'analysis', 'out'), { recursive: true })
  await writeFile(outPath, `${lines.join('\n')}\n`, 'utf-8')
  console.log(`[report-data-sizes] Wrote ${outPath}`)
}

void main().catch((err) => {
  console.error(err)
  process.exit(1)
})
