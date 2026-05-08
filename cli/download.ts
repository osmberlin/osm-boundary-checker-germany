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

  --yes / --non-interactive   Skip prompts (reuse cache; only Geofabrik PBF unless --all)
  --all                       With --yes: also BKG ZIP + all HTTP official areas
  --force                     With --yes: force fresh where applicable (same as choosing "force" in the menu)
  -h, --help                  This text

One-shot full refresh (no menu): bun run download:all
`)
}

function runFilterScript(repoRoot: string, script: string, args: string[] = []): number {
  const r = spawnSync('bun', ['run', '--filter', './scripts', script, ...args], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: { ...process.env, CI: process.env.CI ?? '' },
  })
  return r.status ?? 1
}

function parseArgv(argv: string[]) {
  return {
    help: argv.includes('--help') || argv.includes('-h'),
    nonInteractive:
      process.env.CI === '1' ||
      process.env.CI === 'true' ||
      argv.includes('--yes') ||
      argv.includes('--non-interactive'),
    all: argv.includes('--all'),
    force: argv.includes('--force'),
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  if (parseArgv(argv).help) {
    printHelp()
    return
  }

  const repoRoot = process.cwd()
  const { nonInteractive, all, force } = parseArgv(argv)

  let how: How
  let which: Which[]

  if (nonInteractive) {
    how = force ? 'force' : 'reuse'
    const allTargets: Which[] = ['pbf', 'bkg_zip', 'official_http']
    which = all ? allTargets : ['pbf']
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
          hint: 'extract:osm-pbf → .cache/osm/germany-latest.osm.pbf',
        },
        {
          value: 'bkg_zip',
          label: 'BKG VG25 Produkt-ZIP',
          hint: 'bkg:download → .cache/bkg/',
        },
        {
          value: 'official_http',
          label: 'Amtliche HTTP-/WFS-Quellen (alle Areas mit official.download)',
          hint: 'extract:official (scripts) — per-area official.fgb',
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
          'Vergleich/FlatGeobufs passiert in `bun run extract:osm` automatisch für die gewählten Extrakte — ' +
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
          'Vergleich/FlatGeobufs passiert in `bun run extract:osm` automatisch — nicht in diesem Download-Schritt.\n',
      ),
    )
  }

  let code = 0
  if (which.includes('bkg_zip')) {
    console.log(cliHeadline('[download] bkg:download'))
    const c = runFilterScript(repoRoot, 'bkg:download', forceArgs)
    if (c !== 0) code = c
  }
  if (which.includes('pbf')) {
    console.log(cliHeadline('[download] extract:osm-pbf'))
    const c = runFilterScript(repoRoot, 'extract:osm-pbf', forceArgs)
    if (c !== 0) code = c
  }
  if (which.includes('official_http')) {
    console.log(cliHeadline('[download] extract:official'))
    const c = runFilterScript(repoRoot, 'extract:official', forceArgs)
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
