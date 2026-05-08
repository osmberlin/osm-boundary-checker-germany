#!/usr/bin/env bun
/**
 * Download menu (`bun run download`): how aggressively to hit the network, then which
 * artefacts (Geofabrik PBF, BKG ZIP, HTTP official). OSM tags-filter runs later inside
 * `extract:osm` when building FlatGeobufs — not in this step.
 */
import { spawnSync } from 'node:child_process'
import * as p from '@clack/prompts'
import { cliErr, cliHeadline, cliMuted, cliOk } from '../scripts/shared/cliStyle.ts'

type How = 'reuse' | 'force'
type Which = 'pbf' | 'bkg_zip' | 'official_http'

function printHelp(): void {
  console.log(`Usage: bun run download [options]

Interactive: (1) reuse vs force fresh downloads, (2) multiselect targets (default: Geofabrik PBF only),
then a short notice before anything runs.

  --yes / --non-interactive   Skip prompts (see --all / --targets)
  --all                       With --yes: PBF + BKG ZIP + all HTTP official (same as --targets pbf,bkg,official)
  --targets <list>            With --yes: comma-separated subset instead of default PBF-only.
                              Tokens: pbf | bkg | official (aliases: osm-pbf, bkg_zip, http)
  --force                     With --yes: force fresh where applicable (same as choosing "force" in the menu)
  -h, --help                  This text

Examples (no menu):
  bun run download -- --yes                          Geofabrik PBF only (reuse rules)
  bun run download -- --yes --all                    Everything above
  bun run download -- --yes --targets bkg            BKG VG25 ZIP only
  bun run download -- --yes --targets official       HTTP/WFS official fetch only (all configured areas)
  bun run download -- --yes --targets pbf,official   PBF + HTTP official
  bun run download -- --yes --all --force            Full refresh from sources
`)
}

function runFilterScript(repoRoot: string, script: string, args: string[] = []): number {
  const r = spawnSync('bun', ['run', '--filter', './scripts', script, ...args], {
    cwd: repoRoot,
    stdio: 'inherit',
  })
  return r.status ?? 1
}

const TARGET_ALIASES: Record<string, Which> = {
  pbf: 'pbf',
  osm: 'pbf',
  'osm-pbf': 'pbf',
  bkg: 'bkg_zip',
  bkg_zip: 'bkg_zip',
  zip: 'bkg_zip',
  official: 'official_http',
  official_http: 'official_http',
  http: 'official_http',
}

function readTargetsArg(argv: string[]): string | null {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === undefined) continue
    if (a === '--targets') {
      return argv[i + 1] ?? ''
    }
    if (a.startsWith('--targets=')) {
      return a.slice('--targets='.length)
    }
  }
  return null
}

function parseTargetsList(raw: string | null): Which[] | null {
  if (raw === null) return null
  const trimmed = raw.trim()
  if (trimmed === '') return null
  const tokens = trimmed.split(',').map((s) => s.trim().toLowerCase())
  const out: Which[] = []
  for (const t of tokens) {
    if (t === '') continue
    const w = TARGET_ALIASES[t]
    if (w === undefined) {
      console.error(
        cliErr(
          `[download] Unknown --targets token "${t}". Use: pbf, bkg, official (comma-separated).`,
        ),
      )
      process.exit(1)
    }
    if (!out.includes(w)) out.push(w)
  }
  if (out.length === 0) {
    console.error(cliErr('[download] --targets must list at least one of: pbf, bkg, official.'))
    process.exit(1)
  }
  return out
}

function parseArgv(argv: string[]) {
  return {
    nonInteractive: argv.includes('--yes') || argv.includes('--non-interactive'),
    all: argv.includes('--all'),
    force: argv.includes('--force'),
    targets: parseTargetsList(readTargetsArg(argv)),
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  if (argv.includes('--help') || argv.includes('-h')) {
    printHelp()
    return
  }

  const repoRoot = process.cwd()
  const { nonInteractive, all, force, targets: targetsFlag } = parseArgv(argv)

  if (targetsFlag !== null && !nonInteractive) {
    console.error(cliErr('[download] --targets requires --yes (or CI) non-interactive mode.'))
    process.exit(1)
  }
  if (nonInteractive && targetsFlag !== null && all) {
    console.error(cliErr('[download] Use either --all or --targets, not both.'))
    process.exit(1)
  }

  let how: How
  let which: Which[]

  if (nonInteractive) {
    how = force ? 'force' : 'reuse'
    const allTargets: Which[] = ['pbf', 'bkg_zip', 'official_http']
    if (all) {
      which = allTargets
    } else if (targetsFlag !== null) {
      which = targetsFlag
    } else {
      which = ['pbf']
    }
  } else {
    p.intro('download')
    const h = await p.select<How>({
      message: 'Wie laden? / How to fetch?',
      options: [
        {
          value: 'reuse',
          label: 'Cache nutzen wenn möglich (nur holen wenn nötig)',
          hint: 'Standard — kein --force',
        },
        {
          value: 'force',
          label: 'Frisch von der Quelle erzwingen',
          hint: 'Setzt --force wo unterstützt (PBF, BKG, HTTP-official)',
        },
      ],
      initialValue: 'reuse',
    })
    if (p.isCancel(h)) {
      p.cancel('Abgebrochen.')
      process.exit(0)
    }
    how = h

    const w = await p.multiselect<Which>({
      message: 'Was laden? (mehrfach) / What to download?',
      options: [
        {
          value: 'pbf',
          label: 'Geofabrik Deutschland OSM PBF',
          hint: 'non-interactive: bun run download -- --yes --targets pbf',
        },
        {
          value: 'bkg_zip',
          label: 'BKG VG25 Produkt-ZIP',
          hint: 'non-interactive: bun run download -- --yes --targets bkg',
        },
        {
          value: 'official_http',
          label: 'Amtliche HTTP-/WFS-Quellen (alle Areas mit official.download)',
          hint: 'non-interactive: bun run download -- --yes --targets official',
        },
      ],
      initialValues: ['pbf'],
      required: true,
    })
    if (p.isCancel(w)) {
      p.cancel('Abgebrochen.')
      process.exit(0)
    }
    which = w
    console.log(
      cliMuted(
        '\nHinweis: OSM wird hier nur als .pbf geladen. Das Filtern (osmium tags-filter) für ' +
          'Vergleich/FlatGeobufs passiert in `bun run extract` / `bun run extract:osm` automatisch für die gewählten Extrakte — ' +
          'nicht in diesem Download-Schritt.\n',
      ),
    )
    p.outro('Start…')
  }

  const forceArgs = how === 'force' ? ['--force'] : []

  if (nonInteractive) {
    console.log(
      cliMuted(
        '\nHinweis: OSM wird hier nur als .pbf geladen. Das Filtern (osmium tags-filter) für ' +
          'Vergleich/FlatGeobufs passiert in `bun run extract` / `bun run extract:osm` automatisch — nicht in diesem Download-Schritt.\n',
      ),
    )
  }

  let code = 0
  if (which.includes('bkg_zip')) {
    console.log(cliHeadline('[download] download:bkg'))
    const c = runFilterScript(repoRoot, 'download:bkg', forceArgs)
    if (c !== 0) code = c
  }
  if (which.includes('pbf')) {
    console.log(cliHeadline('[download] download:osm-pbf'))
    const c = runFilterScript(repoRoot, 'download:osm-pbf', forceArgs)
    if (c !== 0) code = c
  }
  if (which.includes('official_http')) {
    console.log(cliHeadline('[download] download:official'))
    const c = runFilterScript(repoRoot, 'download:official', forceArgs)
    if (c !== 0) code = c
  }

  if (code === 0) console.log(cliOk('[download] Done.'))
  else console.error(cliErr(`[download] Finished with exit code ${code}`))
  process.exit(code)
}

main().catch((e) => {
  console.error(cliErr('[download]'), e)
  process.exit(1)
})
