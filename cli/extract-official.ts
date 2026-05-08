#!/usr/bin/env bun
import { spawnSync } from 'node:child_process'
/**
 * Official boundaries menu (`bun run extract:official`).
 * BKG VG25 extract vs HTTP/Direct groups (by download URL). HTTP fetch uses the `download` CLI (`--targets official`) or the scripts engine via `--filter ./scripts`.
 */
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import * as p from '@clack/prompts'
import { areaHasCompareConfig, loadAreaConfig } from '../scripts/shared/areaConfig.ts'
import { cliErr, cliHeadline, cliOk } from '../scripts/shared/cliStyle.ts'
import type { DatasetConfig } from '../scripts/shared/datasetConfig.ts'
import { DATASETS_DIRECTORY } from '../scripts/shared/datasetPaths.ts'
import {
  type DownloadOfficialHttp,
  parseDownloadOfficial,
} from '../scripts/shared/downloadOfficialConfig.ts'

type MenuVal = '__bkg__' | `http:${number}`

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

function runFilterScript(repoRoot: string, script: string, args: string[] = []): number {
  const r = spawnSync('bun', ['run', '--filter', './scripts', script, ...args], {
    cwd: repoRoot,
    stdio: 'inherit',
  })
  return r.status ?? 1
}

function classify(repoRoot: string): {
  bkgAreaCount: number
  httpGroups: { url: string; areas: string[]; spec: DownloadOfficialHttp }[]
} {
  const areas = discoverAreas(repoRoot)
  let bkgAreaCount = 0
  const urlToGroup = new Map<string, { areas: string[]; spec: DownloadOfficialHttp }>()
  for (const area of areas) {
    let cfg: DatasetConfig
    try {
      cfg = loadAreaConfig(repoRoot, area)
    } catch {
      continue
    }
    if (isBkgExtractArea(cfg)) bkgAreaCount++
    if (cfg.officialMode !== 'direct') continue
    try {
      const spec = parseDownloadOfficial(cfg)
      if (!spec) continue
      const prev = urlToGroup.get(spec.url)
      if (prev) {
        prev.areas.push(area)
      } else {
        urlToGroup.set(spec.url, { areas: [area], spec })
      }
    } catch {
      // invalid official.download
    }
  }
  const httpGroups = [...urlToGroup.entries()]
    .map(([url, g]) => ({ url, areas: g.areas.sort(), spec: g.spec }))
    .sort((a, b) => a.url.localeCompare(b.url))
  return { bkgAreaCount, httpGroups }
}

function parseArgv(argv: string[]) {
  let area: string | null = null
  let force = false
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--area') {
      const v = argv[i + 1]
      if (v !== undefined) {
        area = v
        i++
      }
    }
    if (argv[i] === '--force') force = true
  }
  return {
    help: argv.includes('--help') || argv.includes('-h'),
    area,
    force,
    nonInteractive: argv.includes('--yes') || argv.includes('--non-interactive'),
  }
}

function printHelp(): void {
  console.log(`Usage: bun run extract:official [options]

Interactive: pick BKG extract and/or HTTP-official groups (grouped by download URL).

  --area <folder>             Run only that dataset (BKG extract or HTTP official)
  --force                     Forward to BKG / HTTP download engines
  --yes / --non-interactive   BKG (if any) + all HTTP official areas, no menu (required for automation)
  -h, --help                  This text

HTTP official fetch only (no menu): bun run download -- --yes --targets official
  Re-fetch: add --force. One area: bun run --filter ./scripts download:official -- --area <folder>
`)
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const parsed = parseArgv(argv)
  if (parsed.help) {
    printHelp()
    return
  }

  const repoRoot = process.cwd()
  const { bkgAreaCount, httpGroups } = classify(repoRoot)
  const hasBkg = bkgAreaCount > 0
  const hasHttp = httpGroups.length > 0

  if (!hasBkg && !hasHttp) {
    console.error(
      cliErr(`No BKG-profile areas and no official.download areas under ${DATASETS_DIRECTORY}/.`),
    )
    process.exit(1)
  }

  const forceArgs = parsed.force ? ['--force'] : []

  if (parsed.area) {
    const a = parsed.area
    if (!discoverAreas(repoRoot).includes(a)) {
      console.error(cliErr(`Unknown area: ${a}`))
      process.exit(1)
    }
    let cfg: DatasetConfig
    try {
      cfg = loadAreaConfig(repoRoot, a)
    } catch (e) {
      console.error(cliErr(String(e)))
      process.exit(1)
    }
    let ran = false
    let code = 0
    if (isBkgExtractArea(cfg)) {
      ran = true
      console.log(cliHeadline(`[extract:official] extract:bkg — ${a}`))
      const c = runFilterScript(
        repoRoot,
        'extract:bkg',
        parsed.nonInteractive ? ['--', '--yes', '--area', a] : ['--', '--area', a],
      )
      if (c !== 0) code = c
    }
    if (cfg.officialMode === 'direct') {
      let spec: ReturnType<typeof parseDownloadOfficial> = null
      try {
        spec = parseDownloadOfficial(cfg)
      } catch (e) {
        console.error(cliErr(String(e)))
        process.exit(1)
      }
      if (spec) {
        ran = true
        console.log(cliHeadline(`[extract:official] download:official — ${a}`))
        const c = runFilterScript(repoRoot, 'download:official', ['--', '--area', a, ...forceArgs])
        if (c !== 0) code = c
      }
    }
    if (!ran) {
      console.error(cliErr(`Area ${a} is not a BKG extract area and has no official.download.`))
      process.exit(1)
    }
    process.exit(code)
  }

  if (parsed.nonInteractive) {
    let code = 0
    if (hasBkg) {
      console.log(cliHeadline('[extract:official] extract:bkg'))
      const c = runFilterScript(repoRoot, 'extract:bkg', ['--', '--yes'])
      if (c !== 0) code = c
    }
    if (hasHttp) {
      console.log(cliHeadline('[extract:official] download:official (all HTTP areas)'))
      const c = runFilterScript(
        repoRoot,
        'download:official',
        forceArgs.length ? ['--', ...forceArgs] : [],
      )
      if (c !== 0) code = c
    }
    if (code === 0) console.log(cliOk('[extract:official] Done.'))
    else console.error(cliErr(`[extract:official] Exit ${code}`))
    process.exit(code)
  }

  p.intro('extract:official')
  const options: { value: MenuVal; label: string; hint: string }[] = []
  if (hasBkg) {
    options.push({
      value: '__bkg__',
      label: `BKG VG250 → official.fgb (${bkgAreaCount} Dataset${bkgAreaCount === 1 ? '' : 's'})`,
      hint: 'extract:official -- --area …',
    })
  }
  httpGroups.forEach((g, i) => {
    const short =
      g.areas.length <= 4
        ? g.areas.join(', ')
        : `${g.areas.slice(0, 3).join(', ')} +${g.areas.length - 3}`
    const { format, upstreamDateResolver } = g.spec
    options.push({
      value: `http:${i}`,
      label: `${short} (${format} · ${upstreamDateResolver})`,
      hint: 'official.download',
    })
  })

  const choice = await p.multiselect<MenuVal>({
    message: 'Welche amtlichen Extrakte? / Which official extracts?',
    options,
    initialValues: options.map((o) => o.value),
    required: true,
  })
  if (p.isCancel(choice)) {
    p.cancel('Abgebrochen.')
    process.exit(0)
  }

  p.outro('Start…')

  let code = 0
  if (choice.includes('__bkg__')) {
    console.log(cliHeadline('[extract:official] extract:bkg'))
    const c = runFilterScript(repoRoot, 'extract:bkg', [])
    if (c !== 0) code = c
  }
  for (let i = 0; i < httpGroups.length; i++) {
    const key = `http:${i}` as MenuVal
    if (!choice.includes(key)) continue
    const { areas } = httpGroups[i]!
    for (const area of areas) {
      console.log(cliHeadline(`[extract:official] download:official — ${area}`))
      const c = runFilterScript(repoRoot, 'download:official', ['--', '--area', area, ...forceArgs])
      if (c !== 0) code = c
    }
  }

  if (code === 0) console.log(cliOk('[extract:official] Done.'))
  else console.error(cliErr(`[extract:official] Exit ${code}`))
  process.exit(code)
}

main().catch((e) => {
  console.error(cliErr('[extract:official]'), e)
  process.exit(1)
})
