#!/usr/bin/env bun
import { spawnSync } from 'node:child_process'
/**
 * Top-level extract menu (`bun run extract`): choose pipeline steps, then `extract:osm` / `extract:official`.
 */
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import * as p from '@clack/prompts'
import { areaHasCompareConfig, loadAreaConfig } from '../scripts/shared/areaConfig.ts'
import { cliErr, cliHeadline, cliMuted, cliOk } from '../scripts/shared/cliStyle.ts'
import type { DatasetConfig } from '../scripts/shared/datasetConfig.ts'
import { DATASETS_DIRECTORY } from '../scripts/shared/datasetPaths.ts'
import { parseDownloadOfficial } from '../scripts/shared/downloadOfficialConfig.ts'

type Scope = 'official' | 'osm'

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

function isBkgExtractArea(config: DatasetConfig): boolean {
  if (config.officialMode === 'profile') return true
  if (config.officialMode === 'direct' && config.official.extractFilter !== undefined) return true
  return false
}

/** Datasets with BKG extract path and/or official.download (same notion as extract:official). */
function countAmtlicheDownloads(repoRoot: string): number {
  let n = 0
  for (const area of discoverAreas(repoRoot)) {
    let cfg: DatasetConfig
    try {
      cfg = loadAreaConfig(repoRoot, area)
    } catch {
      continue
    }
    let hasHttp = false
    if (cfg.officialMode === 'direct') {
      try {
        hasHttp = parseDownloadOfficial(cfg) !== null
      } catch {
        hasHttp = false
      }
    }
    if (isBkgExtractArea(cfg) || hasHttp) n++
  }
  return n
}

function printHelp(): void {
  console.log(`Usage: bun run extract [options]

Interactive: select pipeline steps; OSM runs before official when both are selected.

  --yes / --non-interactive   Run both scopes without prompts
  -h, --help                  This text

Focused CLIs:
  bun run extract:osm        OSM PBF handling + FlatGeobuf kinds
  bun run extract:official   BKG + HTTP/Direct groups

Downloads (PBF, BKG ZIP, HTTP fetch): bun run download
`)
}

function runRootScript(repoRoot: string, rel: string, args: string[] = []): number {
  const r = spawnSync('bun', [join(repoRoot, rel), ...args], {
    cwd: repoRoot,
    stdio: 'inherit',
  })
  return r.status ?? 1
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  if (argv.includes('--help') || argv.includes('-h')) {
    printHelp()
    return
  }

  const repoRoot = process.cwd()
  const nonInteractive = argv.includes('--yes') || argv.includes('--non-interactive')

  const extra = nonInteractive ? ['--yes'] : []

  let scopes: Scope[]
  if (nonInteractive) {
    scopes = ['osm', 'official']
  } else {
    p.intro('extract')
    const amtlicheN = countAmtlicheDownloads(repoRoot)
    const choice = await p.multiselect<Scope>({
      message: 'Teilprozesse auswählen',
      options: [
        {
          value: 'osm',
          label: 'Extract OSM datasets',
          hint: 'Shared filtered FlatGeobufs (.fgb)',
        },
        {
          value: 'official',
          label: 'Extract official datasets',
          hint: `${amtlicheN} configured areas (BKG and/or HTTP)`,
        },
      ],
      initialValues: ['osm', 'official'],
      required: true,
    })
    if (p.isCancel(choice)) {
      p.cancel('Cancelled.')
      process.exit(0)
    }
    scopes = choice
    const displayOrder: Scope[] = ['osm', 'official']
    for (const s of displayOrder) {
      if (!scopes.includes(s)) continue
      const cmd = s === 'osm' ? 'bun run extract:osm' : 'bun run extract:official'
      console.log(cliMuted(`  ${cmd}`))
    }
    p.outro('Starting…')
  }

  let code = 0
  const order: Scope[] = ['osm', 'official']
  for (const s of order) {
    if (!scopes.includes(s)) continue
    if (s === 'official') {
      console.log(cliHeadline('[extract] extract:official'))
      const c = runRootScript(repoRoot, join('cli', 'extract-official.ts'), extra)
      if (c !== 0) code = c
    } else {
      console.log(cliHeadline('[extract] extract:osm'))
      const c = runRootScript(repoRoot, join('cli', 'extract-osm.ts'), extra)
      if (c !== 0) code = c
    }
  }

  if (code === 0) console.log(cliOk('[extract] Done.'))
  else console.error(cliErr(`[extract] Finished with exit code ${code}`))
  process.exit(code)
}

main().catch((e) => {
  console.error(cliErr('[extract]'), e)
  process.exit(1)
})
