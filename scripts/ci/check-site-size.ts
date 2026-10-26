import { appendFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

/**
 * WHAT: Fails when the static site (default `report/public`, in deploy `report/dist`) is larger than
 * the GitHub Pages limit, and warns from 90 % on. Prints the largest datasets split by file kind.
 * WHY: Pages refuses or flags sites over 1 GB; a new dataset, a licence change (more edit GeoJSON)
 * or a higher tile zoom can push us over without anyone noticing until the deploy breaks.
 * Runs in `bun run check` (local data), after `sync-runtime-assets` in the refresh and before the
 * Pages upload. On GitHub it writes an `::error` annotation and the table into the step summary.
 *
 *   bun run scripts/ci/check-site-size.ts [dir]
 */

/** GitHub Pages: "Published GitHub Pages sites may be no larger than 1 GB." */
export const SITE_SIZE_LIMIT_BYTES = 1_000_000_000
export const SITE_SIZE_WARN_RATIO = 0.9

export type SiteFile = { path: string; bytes: number }

export type SiteSizeReport = {
  totalBytes: number
  status: 'ok' | 'warn' | 'fail'
  /** Largest datasets first: bytes per file kind (`official_for_edit`, `features`, archive names). */
  datasets: { id: string; bytes: number; byKind: Record<string, number> }[]
}

/** File kind inside `datasets/<id>/output/`: the folder for per-row files, else the file name. */
function fileKind(pathInDataset: string): string {
  const parts = pathInDataset.split('/')
  if (parts[0] !== 'output') return parts.join('/')
  return parts.length > 2 ? parts[1]! : (parts[1] ?? 'output')
}

export function summarizeSiteSize(
  files: readonly SiteFile[],
  limitBytes = SITE_SIZE_LIMIT_BYTES,
): SiteSizeReport {
  let totalBytes = 0
  const datasets = new Map<string, { bytes: number; byKind: Record<string, number> }>()
  for (const file of files) {
    totalBytes += file.bytes
    const match = /^datasets\/([^/]+)\/(.+)$/.exec(file.path)
    if (!match) continue
    const entry = datasets.get(match[1]!) ?? { bytes: 0, byKind: {} }
    const kind = fileKind(match[2]!)
    entry.bytes += file.bytes
    entry.byKind[kind] = (entry.byKind[kind] ?? 0) + file.bytes
    datasets.set(match[1]!, entry)
  }
  const status =
    totalBytes > limitBytes
      ? 'fail'
      : totalBytes > limitBytes * SITE_SIZE_WARN_RATIO
        ? 'warn'
        : 'ok'
  return {
    totalBytes,
    status,
    datasets: [...datasets.entries()]
      .map(([id, entry]) => ({ id, ...entry }))
      .sort((a, b) => b.bytes - a.bytes),
  }
}

function listFiles(root: string): SiteFile[] {
  const out: SiteFile[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, entry.name)
      if (entry.isDirectory()) walk(abs)
      else if (entry.isFile()) out.push({ path: relative(root, abs), bytes: statSync(abs).size })
    }
  }
  walk(root)
  return out
}

function mb(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(0)} MB`
}

function main() {
  const dir = resolve(process.argv[2] ?? 'report/public')
  if (!existsSync(dir)) {
    console.log(`[site-size] ${dir} does not exist, nothing to check`)
    return
  }
  const report = summarizeSiteSize(listFiles(dir))
  const headline = `${relative(process.cwd(), dir) || dir}: ${mb(report.totalBytes)} of ${mb(SITE_SIZE_LIMIT_BYTES)} (GitHub Pages limit)`
  const rows = report.datasets.slice(0, 8).map((dataset) => {
    const kinds = Object.entries(dataset.byKind)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([kind, bytes]) => `${kind} ${mb(bytes)}`)
      .join(', ')
    return `| ${dataset.id} | ${mb(dataset.bytes)} | ${kinds} |`
  })
  const table = ['| Dataset | Size | Largest parts |', '| --- | ---: | --- |', ...rows].join('\n')
  const advice =
    'Shrink a dataset in its config: `compare.tileMaxZoom` (e.g. 13), `compare.officialForEdit: "osm_compatible"`, or drop the dataset.'

  console.log(`[site-size] ${headline}\n${table}`)
  const summaryPath = process.env.GITHUB_STEP_SUMMARY
  if (summaryPath) {
    appendFileSync(summaryPath, `### Site size\n\n${headline} — ${report.status}\n\n${table}\n\n`)
  }
  if (report.status === 'ok') return
  const message =
    report.status === 'fail'
      ? `Site is larger than the GitHub Pages limit: ${headline}. ${advice}`
      : `Site is above ${SITE_SIZE_WARN_RATIO * 100} % of the GitHub Pages limit: ${headline}. ${advice}`
  if (process.env.GITHUB_ACTIONS) {
    console.log(`::${report.status === 'fail' ? 'error' : 'warning'} title=Site size::${message}`)
  } else {
    console[report.status === 'fail' ? 'error' : 'warn'](`[site-size] ${message}`)
  }
  if (report.status === 'fail') process.exit(1)
}

if (import.meta.main) main()
