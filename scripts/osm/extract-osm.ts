#!/usr/bin/env bun
import { spawnSync } from 'node:child_process'
/**
 * Build one shared OSM FlatGeobuf for all compare runs: every administrative
 * boundary with `de:regionalschluessel`, plus Germany (`admin_level=2`) when
 * the tag is missing (synthetic RS for BKG Staat).
 *
 * Output: `.cache/osm/germany-admin-boundaries-rs.fgb` (see `germanyOsmPbf.ts`).
 *
 * Prerequisites: `osmium` and `ogr2ogr` on PATH; run `bun run osm:download` first
 * (or set `OSM_GERMANY_PBF` / `--pbf`).
 */
import { existsSync, mkdirSync, statSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DEFAULT_OSM_TAGS_FILTER_EXPRESSIONS,
  GERMANY_OSM_CACHE_DIR,
  GERMANY_OSM_FILTERED_BASENAME,
  GERMANY_OSM_PBF_BASENAME,
  GERMANY_OSM_SHARED_FGB_BASENAME,
} from '../shared/germanyOsmPbf.ts'
import { runtimeRootFromWorkspace } from '../shared/runtimeRoot.ts'
import { workspaceRootFromHere } from '../shared/workspaceRoot.ts'

/** GDAL OSM driver config: promotes `de:regionalschluessel` etc. out of `other_tags`. */
const GDAL_OSM_BOUNDARIES_INI = join(
  dirname(fileURLToPath(import.meta.url)),
  'gdal-osm-boundaries.ini',
)

/**
 * Broad extract: any admin boundary with RS, or Deutschland without RS (synthetic).
 * SQLite dialect: same as legacy `de-staat` when RS missing.
 */
const SHARED_OSM_OGR_SQL = `
SELECT geometry,
  CASE
    WHEN admin_level = '2' AND name = 'Deutschland'
      AND ("de:regionalschluessel" IS NULL OR "de:regionalschluessel" = '')
    THEN '000000000000'
    ELSE "de:regionalschluessel"
  END AS "de:regionalschluessel"
FROM multipolygons
WHERE boundary = 'administrative'
  AND (
    ("de:regionalschluessel" IS NOT NULL AND "de:regionalschluessel" <> '')
    OR (admin_level = '2' AND name = 'Deutschland')
  )
`.trim()

function parseArgs(argv: string[]) {
  let pbf: string | null = null
  let skipTagsFilter = false
  let forceTagsFilter = false
  let dryRun = false
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--pbf') {
      const v = argv[i + 1]
      if (v !== undefined) {
        pbf = v
        i++
      }
      continue
    }
    if (argv[i] === '--skip-tags-filter') skipTagsFilter = true
    if (argv[i] === '--force-tags-filter') forceTagsFilter = true
    if (argv[i] === '--dry-run') dryRun = true
    if (argv[i] === '--area') {
      console.warn('[osm:extract] --area is ignored; a single shared OSM FGB is always built.')
      const v = argv[i + 1]
      if (v !== undefined) i++
    }
  }
  return { pbf, skipTagsFilter, forceTagsFilter, dryRun }
}

function shouldRunTagsFilter(inputPbf: string, filteredPbf: string, force: boolean): boolean {
  if (force) return true
  if (!existsSync(filteredPbf)) return true
  const inStat = statSync(inputPbf)
  const outStat = statSync(filteredPbf)
  return outStat.mtimeMs < inStat.mtimeMs
}

function runOsmiumTagsFilter(
  inputPbf: string,
  filteredPbf: string,
  expressions: string[],
  dryRun: boolean,
): void {
  const args = ['tags-filter', '-o', filteredPbf, '-O', inputPbf, ...expressions]

  if (dryRun) {
    console.log(`[dry-run] osmium ${args.join(' ')}`)
    return
  }

  mkdirSync(dirname(filteredPbf), { recursive: true })
  const r = spawnSync('osmium', args, { stdio: 'inherit' })
  if (r.error) {
    console.error(r.error)
    process.exit(1)
  }
  if (r.status !== 0) process.exit(r.status ?? 1)
}

function runOgr2ogr(inputPbf: string, outFgb: string, dryRun: boolean): void {
  const args = [
    '--config',
    'OSM_CONFIG_FILE',
    GDAL_OSM_BOUNDARIES_INI,
    '-overwrite',
    '-f',
    'FlatGeobuf',
    outFgb,
    inputPbf,
    '-nln',
    'boundaries',
    '-dialect',
    'SQLITE',
    '-sql',
    SHARED_OSM_OGR_SQL,
  ]

  if (dryRun) {
    const q = (a: string) => (/\s/.test(a) ? JSON.stringify(a) : a)
    console.log(`[dry-run] ogr2ogr ${args.map(q).join(' ')}`)
    return
  }

  mkdirSync(dirname(outFgb), { recursive: true })
  if (existsSync(outFgb)) unlinkSync(outFgb)
  const r = spawnSync('ogr2ogr', args, { stdio: 'inherit' })
  if (r.error) {
    console.error(r.error)
    process.exit(1)
  }
  if (r.status !== 0) process.exit(r.status ?? 1)
}

function main() {
  const workspaceRoot = workspaceRootFromHere(import.meta.url)
  const runtimeRoot = runtimeRootFromWorkspace(workspaceRoot)
  const { pbf: pbfArg, skipTagsFilter, forceTagsFilter, dryRun } = parseArgs(process.argv.slice(2))

  const defaultPbf = join(runtimeRoot, GERMANY_OSM_CACHE_DIR, GERMANY_OSM_PBF_BASENAME)
  const inputPbf = pbfArg?.trim() || process.env.OSM_GERMANY_PBF?.trim() || defaultPbf

  if (!existsSync(inputPbf)) {
    if (dryRun) {
      console.warn(`[dry-run] Germany PBF not found (commands assume):\n  ${inputPbf}\n`)
    } else {
      console.error(
        `Germany PBF not found:\n  ${inputPbf}\n\n` +
          `Download with:\n  bun run osm:download\n` +
          `Or set OSM_GERMANY_PBF / pass --pbf /path/to/germany-latest.osm.pbf`,
      )
      process.exit(1)
    }
  }

  const filteredPbf = join(runtimeRoot, GERMANY_OSM_CACHE_DIR, GERMANY_OSM_FILTERED_BASENAME)
  const expressions = [...DEFAULT_OSM_TAGS_FILTER_EXPRESSIONS]

  let pbfForOgr = inputPbf

  if (!skipTagsFilter) {
    const runFilter = dryRun || shouldRunTagsFilter(inputPbf, filteredPbf, forceTagsFilter)
    if (runFilter) {
      console.log(
        `Running osmium tags-filter → ${filteredPbf}\n  expressions: ${expressions.join(', ')}`,
      )
      runOsmiumTagsFilter(inputPbf, filteredPbf, expressions, dryRun)
    } else {
      console.log(`Reusing filtered PBF (up to date):\n  ${filteredPbf}`)
    }
    pbfForOgr = filteredPbf
  } else {
    console.log('Using full input PBF for ogr2ogr (--skip-tags-filter). This can be very slow.')
  }

  const outFgb = join(runtimeRoot, GERMANY_OSM_CACHE_DIR, GERMANY_OSM_SHARED_FGB_BASENAME)
  console.log(
    `\nShared OSM extract → ${join(GERMANY_OSM_CACHE_DIR, GERMANY_OSM_SHARED_FGB_BASENAME)}`,
  )
  runOgr2ogr(pbfForOgr, outFgb, dryRun)

  console.log('\nDone.')
}

main()
