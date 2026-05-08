#!/usr/bin/env bun
/**
 * Root-level OSM extract wizard (`bun run extract:osm`).
 * Runs @clack prompts here (repo cwd → TTY works with `bun run`), then invokes
 * `scripts/osm/extract-osm.ts` once per selected `--kind` (no stdin TTY needed below).
 */
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import * as p from '@clack/prompts'
import { cliErr } from '../scripts/shared/cliStyle.ts'
import {
  GERMANY_OSM_ADMIN_CANDIDATES_FGB_BASENAME,
  GERMANY_OSM_PLZ_CANDIDATES_FGB_BASENAME,
  GERMANY_OSM_SHARED_FGB_BASENAME,
  GERMANY_OSM_SHARED_PLZ_FGB_BASENAME,
} from '../scripts/shared/germanyOsmPbf.ts'

type ExtractKind = 'admin' | 'plz' | 'admin_candidates' | 'plz_candidates'

type PbfFlow = 'reuse_filtered' | 'force_filter'

const KIND_ORDER: ExtractKind[] = ['admin', 'admin_candidates', 'plz', 'plz_candidates']

function sortKinds(kinds: ExtractKind[]): ExtractKind[] {
  return KIND_ORDER.filter((k) => kinds.includes(k))
}

function passthroughArgs(argv: string[]): string[] {
  const dash = argv.indexOf('--')
  if (dash >= 0) {
    return argv.slice(dash + 1)
  }
  const out: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--help' || a === '-h' || a === '--yes' || a === '--non-interactive') continue
    if (a === '--kind') {
      if (argv[i + 1] !== undefined) i++
      continue
    }
    out.push(a)
    if (a === '--pbf' && argv[i + 1] !== undefined) {
      out.push(argv[i + 1]!)
      i++
    }
  }
  return out
}

function scriptPath(repoRoot: string): string {
  return join(repoRoot, 'scripts', 'osm', 'extract-osm.ts')
}

function runKind(repoRoot: string, kind: ExtractKind, extra: string[]): number {
  const r = spawnSync(process.execPath, [scriptPath(repoRoot), '--kind', kind, ...extra], {
    cwd: repoRoot,
    stdio: 'inherit',
  })
  return r.status ?? 1
}

function printHelp(): void {
  console.log(`Usage: bun run extract:osm [options]

Interactive wizard (default): .fgb from cache vs fresh PBF-Extract (--force-tags-filter), then which
FlatGeobufs to build. Each step runs scripts/osm/extract-osm.ts with an explicit --kind (TTY-safe).

  --yes / --non-interactive   Build all four kinds without prompts (CI-friendly; reuse filtered PBF when valid)
  --help, -h                  This text

Options after -- are forwarded to each extract-osm run (e.g. --dry-run, --pbf <path>, --force-tags-filter).
`)
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  if (argv.includes('--help') || argv.includes('-h')) {
    printHelp()
    return
  }

  const repoRoot = process.cwd()
  const nonInteractive =
    process.env.CI === '1' ||
    process.env.CI === 'true' ||
    argv.includes('--yes') ||
    argv.includes('--non-interactive')

  const forward = passthroughArgs(argv)

  let kinds: ExtractKind[]
  let pbfExtra: string[] = []
  if (nonInteractive) {
    kinds = [...KIND_ORDER]
  } else {
    p.intro('extract:osm')
    const flow = await p.select<PbfFlow>({
      message: 'OSM-Zwischenlauf / OSM PBF for this extract',
      options: [
        {
          value: 'reuse_filtered',
          label: '.fgb aus dem Cache extrahieren',
          hint: 'nur FGBs extrahieren; aber Cache erneuern falls nötig',
        },
        {
          value: 'force_filter',
          label: '.fgb aus frischem PBF-Extract erzeugen',
          hint: 'osmium tags-filter erzwingen (--force-tags-filter)',
        },
      ],
      initialValue: 'reuse_filtered',
    })
    if (p.isCancel(flow)) {
      p.cancel('Abgebrochen.')
      process.exit(0)
    }
    if (flow === 'force_filter') pbfExtra = ['--force-tags-filter']

    const selected = await p.multiselect<ExtractKind>({
      message: 'Welche OSM-Extrakte? / Which OSM extracts?',
      options: [
        {
          value: 'admin',
          label: 'admin — Haupt-Polygone (starker Match)',
          hint: GERMANY_OSM_SHARED_FGB_BASENAME,
        },
        {
          value: 'admin_candidates',
          label: 'admin_candidates — Punkt-Schicht (Kandidaten-UI)',
          hint: GERMANY_OSM_ADMIN_CANDIDATES_FGB_BASENAME,
        },
        {
          value: 'plz',
          label: 'plz — Postleitzahl-Polygone',
          hint: GERMANY_OSM_SHARED_PLZ_FGB_BASENAME,
        },
        {
          value: 'plz_candidates',
          label: 'plz_candidates — PLZ-Kandidaten (Punkte)',
          hint: GERMANY_OSM_PLZ_CANDIDATES_FGB_BASENAME,
        },
      ],
      initialValues: [...KIND_ORDER],
      required: true,
    })
    if (p.isCancel(selected)) {
      p.cancel('Abgebrochen.')
      process.exit(0)
    }
    kinds = sortKinds(selected)
    p.outro('Starte Extrakt(e)…')
  }

  const engineExtra = [...forward, ...pbfExtra]

  let code = 0
  for (const kind of sortKinds(kinds)) {
    const c = runKind(repoRoot, kind, engineExtra)
    if (c !== 0) code = c
  }
  process.exit(code)
}

main().catch((e) => {
  console.error(cliErr('[extract:osm]'), e)
  process.exit(1)
})
