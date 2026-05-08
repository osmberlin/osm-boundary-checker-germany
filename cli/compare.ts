#!/usr/bin/env bun
/**
 * Interactive compare (`bun run compare`).
 * One prompt: "All areas" (first, default) or a specific dataset, then `compare-boundaries` per area.
 * On full success, runs `bun run --filter report sync-runtime-assets` unless `--no-sync` or COMPARE_NO_SYNC=1.
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import * as p from '@clack/prompts'
import { areaHasCompareConfig } from '../scripts/shared/areaConfig.ts'
import { cliErr, cliHeadline, cliWarn } from '../scripts/shared/cliStyle.ts'
import { DATASETS_DIRECTORY } from '../scripts/shared/datasetPaths.ts'

function parseArgs(argv: string[]) {
  let area: string | null = null
  let all = false
  let noSync = false
  let yes = false
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--area') {
      const v = argv[i + 1]
      if (v !== undefined) {
        area = v
        i++
      }
    }
    if (argv[i] === '--all') all = true
    if (argv[i] === '--no-sync') noSync = true
    if (argv[i] === '--yes') yes = true
  }
  return { area, all, noSync, yes }
}

function discoverAreas(repoRoot: string): string[] {
  const datasetsRoot = join(repoRoot, DATASETS_DIRECTORY)
  if (!existsSync(datasetsRoot)) return []
  const out: string[] = []
  for (const name of readdirSync(datasetsRoot, { withFileTypes: true })) {
    if (!name.isDirectory()) continue
    if (name.name.startsWith('.')) continue
    if (areaHasCompareConfig(repoRoot, name.name)) out.push(name.name)
  }
  return out.sort()
}

/** Always `--no-sync`: this entry point runs `sync-runtime-assets` in the report workspace once after all areas. */
function runCompareScript(repoRoot: string, area: string): Promise<number> {
  const script = join(repoRoot, 'scripts', 'compare', 'compare-boundaries.ts')
  const args = [script, '--area', area, '--no-sync']
  return new Promise((resolve, reject) => {
    const child = spawn('bun', args, {
      cwd: repoRoot,
      stdio: 'inherit',
    })
    child.on('close', (code) => resolve(code ?? 1))
    child.on('error', reject)
  })
}

function syncReportAssets(repoRoot: string): void {
  if (process.env.COMPARE_NO_SYNC === '1') return
  console.log(`\n${cliHeadline('[compare] sync-runtime-assets (report) …')}`)
  const r = spawnSync('bun', ['run', '--filter', 'report', 'sync-runtime-assets'], {
    cwd: repoRoot,
    stdio: 'inherit',
  })
  if ((r.status ?? 1) !== 0) {
    console.warn(cliWarn(`[compare] sync-runtime-assets exited with ${r.status}`))
  }
}

function printHelp(): void {
  console.log(`Usage: bun run compare [options]

Interactive: one list — "All areas" (default) or pick a single dataset.

  --area <folder>     Compare only this area (no menu)
  --all               Compare all discoverable areas (no menu)
  --yes               Non-interactive: use with --area or --all, or alone to compare all areas
  --no-sync           Do not run report workspace sync-runtime-assets after success
  COMPARE_NO_SYNC=1   Same as --no-sync (also respected by compare-boundaries.ts)

Sync after success runs unless --no-sync or COMPARE_NO_SYNC=1.
`)
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--help') || argv.includes('-h')) {
    printHelp()
    process.exit(0)
  }

  const repoRoot = process.cwd()
  const { area: flagArea, all: flagAll, noSync, yes } = parseArgs(argv)
  const areas = discoverAreas(repoRoot)

  if (areas.length === 0) {
    console.error(cliErr(`No folders with config.jsonc found under ${DATASETS_DIRECTORY}/.`))
    process.exit(1)
  }

  let selected: string[] = []

  if (yes) {
    if (flagArea) selected = [flagArea]
    else if (flagAll) selected = areas
    else selected = areas
  } else if (flagAll) {
    selected = areas
  } else if (flagArea) {
    selected = [flagArea]
  } else {
    p.intro('compare')
    const ALL = '__all__'
    const choice = await p.select<string>({
      message: 'Welches Gebiet vergleichen? / Which area to compare?',
      options: [
        {
          value: ALL,
          label: `Alle Gebiete (${areas.length})`,
          hint: 'Standard — alle Datasets mit config.jsonc',
        },
        ...areas.map((a) => ({ value: a, label: a })),
      ],
      initialValue: ALL,
    })
    if (p.isCancel(choice)) {
      p.cancel('Abgebrochen.')
      process.exit(0)
    }
    selected = choice === ALL ? [...areas] : [choice]
    p.outro(choice === ALL ? `Vergleiche ${areas.length} Gebiete…` : `Vergleiche ${choice}…`)
  }

  for (const a of selected) {
    if (!areas.includes(a)) {
      console.error(cliErr(`Unknown area: ${a}`))
      process.exit(1)
    }
  }

  let code = 0
  for (const a of selected) {
    const c = await runCompareScript(repoRoot, a)
    if (c !== 0) code = c
  }

  if (code === 0 && !noSync) {
    syncReportAssets(repoRoot)
  }

  process.exit(code)
}

main().catch((e) => {
  console.error(cliErr('[compare]'), e)
  process.exit(1)
})
