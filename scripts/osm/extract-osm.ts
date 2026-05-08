#!/usr/bin/env bun
import { spawnSync } from 'node:child_process'
/**
 * Build the shared OSM FlatGeobufs all compare runs depend on.
 *
 * Without `--kind`: interactive multiselect (TTY) defaulting to admin + admin_candidates;
 * CI / `--yes` / `--non-interactive` / non-TTY runs those two without prompts (`--help`).
 *
 * With `--kind <name>`: one extract only, non-interactive (same as before).
 *
 * Outputs (one per selected kind):
 * - admin:              `.cache/osm/` + `GERMANY_OSM_SHARED_FGB_BASENAME` (keyed polygons)
 * - plz:                `.cache/osm/germany-postal-code-boundaries.fgb` (keyed polygons)
 * - admin_candidates:   `.cache/osm/germany-admin-candidates.fgb` (POINTS — point-on-surface
 *                       for `match_candidates` / OSM-Kandidaten UI)
 * - plz_candidates:     `.cache/osm/germany-postal-code-candidates.fgb` (POINTS)
 *
 * Prerequisites: `osmium` and `ogr2ogr` on PATH; run `bun run extract:osm-pbf` first
 * (or set `OSM_GERMANY_PBF` / `--pbf`). The candidate extracts use SpatiaLite's
 * `ST_PointOnSurface` (verified available in GDAL 3.12) so the geometry is collapsed
 * to a single inside point at extract time.
 */
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as p from '@clack/prompts'
import { areaHasCompareConfig } from '../shared/areaConfig.ts'
import { cliErr, cliHeadline, cliMuted, cliOk, cliWarn } from '../shared/cliStyle.ts'
import { DATASETS_DIRECTORY, datasetFolderPath } from '../shared/datasetPaths.ts'
import {
  DEFAULT_OSM_TAGS_FILTER_EXPRESSIONS,
  GERMANY_OSM_ADMIN_CANDIDATES_FGB_BASENAME,
  GERMANY_OSM_CACHE_DIR,
  GERMANY_OSM_FILTERED_BASENAME,
  GERMANY_OSM_PBF_BASENAME,
  GERMANY_OSM_PLZ_CANDIDATES_FGB_BASENAME,
  GERMANY_OSM_SHARED_FGB_BASENAME,
  GERMANY_OSM_SHARED_PLZ_FGB_BASENAME,
} from '../shared/germanyOsmPbf.ts'
import { checkOsmPbfIntegrity } from '../shared/osmPbfIntegrity.ts'
import { runtimeRootFromWorkspace } from '../shared/runtimeRoot.ts'
import { type AreaSourceMetadataFile, mergeAreaSourceMetadata } from '../shared/sourceMetadata.ts'
import {
  readAreaSourceMetadataFile,
  writeAreaSourceMetadataFile,
} from '../shared/sourceMetadataIo.ts'
import { workspaceRootFromHere } from '../shared/workspaceRoot.ts'
import {
  loadSharedAdminCandidatesExtractConfig,
  loadSharedAdminOsmExtractConfig,
} from './loadOsmExtractConfig.ts'

/** GDAL OSM driver config: promotes `de:regionalschluessel` etc. out of `other_tags`. */
const GDAL_OSM_BOUNDARIES_INI = join(
  dirname(fileURLToPath(import.meta.url)),
  'gdal-osm-boundaries.ini',
)

const SHARED_OSM_PLZ_OGR_SQL = `
SELECT geometry, postal_code
FROM multipolygons
WHERE boundary = 'postal_code'
  AND postal_code IS NOT NULL
  AND postal_code <> ''
`.trim()

const SHARED_OSM_PLZ_CANDIDATES_OGR_SQL = `
SELECT
  ST_PointOnSurface(geometry) AS geometry,
  osm_id,
  "name",
  "postal_code"
FROM multipolygons
WHERE boundary = 'postal_code'
`.trim()

type ExtractKind = 'admin' | 'plz' | 'admin_candidates' | 'plz_candidates'

/** Stable run order when multiple `--kind` steps run in one invocation. */
const EXTRACT_KIND_ORDER: ExtractKind[] = ['admin', 'admin_candidates', 'plz', 'plz_candidates']

function sortKinds(kinds: ExtractKind[]): ExtractKind[] {
  return EXTRACT_KIND_ORDER.filter((k) => kinds.includes(k))
}

function isCiEnv(): boolean {
  const v = process.env.CI?.trim().toLowerCase()
  return v === '1' || v === 'true'
}

function mergeTagsFilterExpressions(workspaceRoot: string, kinds: ExtractKind[]): string[] {
  const merged = new Set<string>(DEFAULT_OSM_TAGS_FILTER_EXPRESSIONS)
  for (const kind of kinds) {
    if (kind === 'admin') {
      for (const expr of buildSharedAdminOgrSql(workspaceRoot).tagsFilterExpressions) {
        merged.add(expr)
      }
    } else if (kind === 'admin_candidates') {
      for (const expr of buildSharedAdminCandidatesOgrSql(workspaceRoot).tagsFilterExpressions) {
        merged.add(expr)
      }
    }
  }
  return Array.from(merged)
}

function printHelp(): void {
  console.log(`Usage: bun run osm:extract [options]

Build shared OSM FlatGeobuf file(s) under ${GERMANY_OSM_CACHE_DIR}/.

When --kind is omitted:
  • TTY + not CI: interactive multiselect (@clack/prompts); default selection = admin + admin_candidates.
  • CI=1 / CI=true, --yes, --non-interactive, or non-TTY stdin: runs admin and admin_candidates without prompts.

When --kind is set: runs that single kind only (no prompts), same as before.

Options:
  --kind admin|plz|admin_candidates|plz_candidates   Single extract (non-interactive)
  --pbf <path>                                       Input PBF (else OSM_GERMANY_PBF or default cache path)
  --skip-tags-filter / --force-tags-filter / --dry-run
  --yes / --non-interactive                          Skip prompts when --kind is omitted (default kinds: admin + admin_candidates)
  -h, --help                                         This text

Outputs (basenames from shared constants in code):
  admin               Keyed administrative multipolygons → ${GERMANY_OSM_SHARED_FGB_BASENAME}
  admin_candidates    Point-on-surface admin layer → ${GERMANY_OSM_ADMIN_CANDIDATES_FGB_BASENAME}
  plz                 Postal polygons → ${GERMANY_OSM_SHARED_PLZ_FGB_BASENAME}
  plz_candidates      Postal candidate points → ${GERMANY_OSM_PLZ_CANDIDATES_FGB_BASENAME}
`)
}

async function resolveKindsWhenImplicit(nonInteractive: boolean): Promise<ExtractKind[]> {
  const defaultPair: ExtractKind[] = ['admin', 'admin_candidates']
  if (nonInteractive || isCiEnv() || !process.stdin.isTTY) {
    return defaultPair
  }

  p.intro('extract:osm')
  const selected = await p.multiselect<ExtractKind>({
    message: 'Welche OSM-FlatGeobufs erstellen? / Which extracts to build?',
    options: [
      {
        value: 'admin',
        label: 'admin — Haupt-Polygone (de:* / starker Match)',
        hint: `${GERMANY_OSM_SHARED_FGB_BASENAME} · keyed multipolygons for strong key match`,
      },
      {
        value: 'admin_candidates',
        label: 'admin_candidates — Punkt-Schicht (Kandidaten / UI)',
        hint: `${GERMANY_OSM_ADMIN_CANDIDATES_FGB_BASENAME} · point-on-surface for match_candidates / OSM candidates UI`,
      },
      {
        value: 'plz',
        label: 'plz — Postleitzahl-Polygone',
        hint: `${GERMANY_OSM_SHARED_PLZ_FGB_BASENAME} · postal_code multipolygons`,
      },
      {
        value: 'plz_candidates',
        label: 'plz_candidates — PLZ-Kandidaten (Punkte)',
        hint: `${GERMANY_OSM_PLZ_CANDIDATES_FGB_BASENAME} · postal_code candidate points`,
      },
    ],
    initialValues: [...defaultPair],
    required: true,
  })
  if (p.isCancel(selected)) {
    p.cancel('Abgebrochen.')
    process.exit(0)
  }

  const sorted = sortKinds(selected)
  const run = await p.confirm({
    message: `Ausführen: ${sorted.join(', ')}? / Run these extracts?`,
    initialValue: true,
  })
  if (p.isCancel(run) || !run) {
    p.cancel('Abgebrochen.')
    process.exit(0)
  }
  p.outro(`${sorted.length} Schritt(e) / step(s).`)
  return sorted
}

function quoteSqlIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`
}

function parseRelationIdForSql(raw: string): number {
  const text = raw.trim()
  if (!/^\d+$/.test(text)) {
    throw new Error(`Invalid relation ID "${raw}" in shared admin extract config`)
  }
  return Number.parseInt(text, 10)
}

function buildSharedAdminOgrSql(workspaceRoot: string): {
  sql: string
  tagsFilterExpressions: string[]
} {
  const cfg = loadSharedAdminOsmExtractConfig(workspaceRoot)
  const propertyChecks = cfg.selectProperties.map((property) => {
    const q = quoteSqlIdentifier(property)
    return `(${q} IS NOT NULL AND ${q} <> '')`
  })
  const relationIds = cfg.includeRelationIds.map(parseRelationIdForSql)
  const relationClause =
    relationIds.length > 0 ? `(-osm_id IN (${relationIds.map(String).join(', ')}))` : null
  const inclusionClauses = [...propertyChecks, ...(relationClause ? [relationClause] : [])]
  if (inclusionClauses.length === 0) {
    throw new Error('Shared admin extract SQL has no inclusion clauses')
  }

  const selectColumns = [
    'geometry',
    'osm_id',
    `CASE
      WHEN osm_id < 0 THEN 'relation/' || CAST(-osm_id AS TEXT)
      WHEN osm_id > 0 THEN 'way/' || CAST(osm_id AS TEXT)
      ELSE NULL
    END AS "@id"`,
    ...cfg.selectProperties.map((property) => quoteSqlIdentifier(property)),
  ]

  const whereClauses = [
    `boundary = 'administrative'`,
    `(${inclusionClauses.join(' OR ')})`,
    ...cfg.additionalWhereClauses,
  ]

  const sql = `
SELECT ${selectColumns.join(',\n       ')}
FROM multipolygons
WHERE ${whereClauses.join('\n  AND ')}
`.trim()
  return { sql, tagsFilterExpressions: cfg.tagsFilterExpressions }
}

/**
 * Points-only admin candidates SQL: every `boundary=administrative` multipolygon at any
 * configured `admin_level`, regardless of whether the de:* keys are set. Geometry is
 * collapsed to `ST_PointOnSurface` so the resulting FGB is small (~5 MB for ~31k features).
 * The compare-time `match_candidates` phase consumes this and tests "candidate point in
 * shrunk official polygon" — see {@link ../compare/lib/matchCandidates.ts}.
 */
function buildSharedAdminCandidatesOgrSql(workspaceRoot: string): {
  sql: string
  tagsFilterExpressions: string[]
} {
  const cfg = loadSharedAdminCandidatesExtractConfig(workspaceRoot)
  const adminLevelLiterals = cfg.adminLevels
    .map((level) => `'${level.replace(/'/g, "''")}'`)
    .join(', ')
  const sql = `
SELECT ST_PointOnSurface(geometry) AS geometry,
       osm_id,
       "admin_level",
       "name",
       "de:regionalschluessel",
       "de:amtlicher_gemeindeschluessel"
FROM multipolygons
WHERE boundary = 'administrative'
  AND admin_level IN (${adminLevelLiterals})
`.trim()
  return { sql, tagsFilterExpressions: cfg.tagsFilterExpressions }
}

function parseArgs(argv: string[]) {
  let pbf: string | null = null
  let skipTagsFilter = false
  let forceTagsFilter = false
  let dryRun = false
  let help = false
  let nonInteractive = false
  let kindExplicit = false
  let kind: ExtractKind = 'admin'
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--help' || a === '-h') {
      help = true
      continue
    }
    if (a === '--yes') {
      nonInteractive = true
      continue
    }
    if (a === '--non-interactive') {
      nonInteractive = true
      continue
    }
    if (a === '--pbf') {
      const v = argv[i + 1]
      if (v !== undefined) {
        pbf = v
        i++
      }
      continue
    }
    if (a === '--skip-tags-filter') skipTagsFilter = true
    if (a === '--force-tags-filter') forceTagsFilter = true
    if (a === '--dry-run') dryRun = true
    if (a === '--kind') {
      kindExplicit = true
      const v = argv[i + 1]?.trim().toLowerCase()
      if (v === 'admin' || v === 'plz' || v === 'admin_candidates' || v === 'plz_candidates') {
        kind = v as ExtractKind
        i++
        continue
      }
      throw new Error(`--kind must be "admin", "plz", "admin_candidates", or "plz_candidates"`)
    }
    if (a === '--area') {
      console.warn(
        cliWarn('[extract:osm] --area is ignored; a single shared OSM FGB is always built.'),
      )
      const v = argv[i + 1]
      if (v !== undefined) i++
    }
  }
  return { pbf, skipTagsFilter, forceTagsFilter, dryRun, help, nonInteractive, kindExplicit, kind }
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
  const args = ['tags-filter', '--no-progress', '-o', filteredPbf, '-O', inputPbf, ...expressions]

  if (dryRun) {
    console.log(cliMuted(`[dry-run] osmium ${args.join(' ')}`))
    return
  }

  mkdirSync(dirname(filteredPbf), { recursive: true })
  const r = spawnSync('osmium', args, { stdio: 'inherit' })
  if (r.error) {
    console.error(cliErr('[extract:osm] osmium tags-filter'), r.error)
    process.exit(1)
  }
  if (r.status !== 0) process.exit(r.status ?? 1)
}

function runOgr2ogr(
  inputPbf: string,
  outFgb: string,
  sql: string,
  dryRun: boolean,
  options?: { geometryType?: 'POINT' },
): void {
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
    sql,
  ]
  if (options?.geometryType) {
    args.push('-nlt', options.geometryType)
  }

  if (dryRun) {
    const q = (a: string) => (/\s/.test(a) ? JSON.stringify(a) : a)
    console.log(cliMuted(`[dry-run] ogr2ogr ${args.map(q).join(' ')}`))
    return
  }

  mkdirSync(dirname(outFgb), { recursive: true })
  if (existsSync(outFgb)) unlinkSync(outFgb)
  const r = spawnSync('ogr2ogr', args, {
    stdio: 'inherit',
    env: { ...process.env, OGR_GEOMETRY_ACCEPT_UNCLOSED_RING: 'YES' },
  })
  if (r.error) {
    console.error(cliErr('[extract:osm] ogr2ogr'), r.error)
    process.exit(1)
  }
  if (r.status !== 0) process.exit(r.status ?? 1)
}

function readOsmPbfHeaderTimestamp(inputPbf: string, dryRun: boolean): string | null {
  if (dryRun) {
    console.log(cliMuted(`[dry-run] osmium fileinfo ${inputPbf} -g header.option.timestamp`))
    return null
  }
  const r = spawnSync('osmium', ['fileinfo', inputPbf, '-g', 'header.option.timestamp'], {
    encoding: 'utf-8',
  })
  if (r.status !== 0) {
    const detail = (r.stderr ?? '').trim()
    console.warn(
      cliWarn(
        `[extract:osm] Could not read OSM header timestamp via osmium fileinfo (${detail || `exit ${r.status}`}).`,
      ),
    )
    return null
  }
  const ts = (r.stdout ?? '').trim()
  return ts.length > 0 ? ts : null
}

function discoverConfiguredAreas(workspaceRoot: string): string[] {
  const datasetsRoot = join(workspaceRoot, DATASETS_DIRECTORY)
  if (!existsSync(datasetsRoot)) return []
  const out: string[] = []
  for (const entry of readdirSync(datasetsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue
    if (areaHasCompareConfig(workspaceRoot, entry.name)) out.push(entry.name)
  }
  return out.sort()
}

function writeOsmSourceMetadataForAreas(
  workspaceRoot: string,
  runtimeRoot: string,
  downloadedAt: string | null,
  dryRun: boolean,
): void {
  const areas = discoverConfiguredAreas(workspaceRoot)
  if (areas.length === 0) return

  if (downloadedAt == null && !dryRun) {
    console.warn(
      cliWarn(
        '[extract:osm] OSM header timestamp unavailable; keeping existing osm.downloadedAt values.',
      ),
    )
  }

  const extractedAtWall = dryRun ? undefined : new Date().toISOString()
  for (const area of areas) {
    const areaPath = datasetFolderPath(runtimeRoot, area)
    const prev: AreaSourceMetadataFile = readAreaSourceMetadataFile(areaPath) ?? {}
    const patch: AreaSourceMetadataFile = {
      osm: {
        downloadedAt: downloadedAt ?? prev.osm?.downloadedAt,
        sourceDateSource: downloadedAt ? 'osm_pbf_header' : prev.osm?.sourceDateSource,
        ...(extractedAtWall ? { extractedAt: extractedAtWall } : {}),
      },
    }
    if (dryRun) {
      console.log(
        cliMuted(
          `[dry-run] update ${DATASETS_DIRECTORY}/${area}/source/metadata.json (osm.downloadedAt=${patch.osm?.downloadedAt ?? 'unchanged'}, osm.extractedAt=would-write)`,
        ),
      )
      continue
    }
    writeAreaSourceMetadataFile(areaPath, mergeAreaSourceMetadata(prev, patch))
  }
}

type ExtractTarget = { basename: string; sql: string; geometryType?: 'POINT' }

function resolveExtractTarget(workspaceRoot: string, kind: ExtractKind): ExtractTarget {
  if (kind === 'admin') {
    const adminExtract = buildSharedAdminOgrSql(workspaceRoot)
    if (adminExtract.sql === '') throw new Error('Missing shared admin extract SQL configuration')
    return { basename: GERMANY_OSM_SHARED_FGB_BASENAME, sql: adminExtract.sql }
  }
  if (kind === 'admin_candidates') {
    const adminCandidatesExtract = buildSharedAdminCandidatesOgrSql(workspaceRoot)
    if (adminCandidatesExtract.sql === '') {
      throw new Error('Missing shared admin candidates extract SQL configuration')
    }
    return {
      basename: GERMANY_OSM_ADMIN_CANDIDATES_FGB_BASENAME,
      sql: adminCandidatesExtract.sql,
      geometryType: 'POINT',
    }
  }
  if (kind === 'plz') {
    return { basename: GERMANY_OSM_SHARED_PLZ_FGB_BASENAME, sql: SHARED_OSM_PLZ_OGR_SQL }
  }
  return {
    basename: GERMANY_OSM_PLZ_CANDIDATES_FGB_BASENAME,
    sql: SHARED_OSM_PLZ_CANDIDATES_OGR_SQL,
    geometryType: 'POINT',
  }
}

function runSharedExtract(
  workspaceRoot: string,
  runtimeRoot: string,
  kinds: ExtractKind[],
  parsed: {
    pbf: string | null
    skipTagsFilter: boolean
    forceTagsFilter: boolean
    dryRun: boolean
  },
): void {
  const { pbf: pbfArg, skipTagsFilter, forceTagsFilter, dryRun } = parsed
  const ordered = sortKinds(kinds)

  const defaultPbf = join(runtimeRoot, GERMANY_OSM_CACHE_DIR, GERMANY_OSM_PBF_BASENAME)
  const inputPbf = pbfArg?.trim() || process.env.OSM_GERMANY_PBF?.trim() || defaultPbf

  if (!existsSync(inputPbf)) {
    if (dryRun) {
      console.warn(cliWarn(`[dry-run] Germany PBF not found (commands assume):\n  ${inputPbf}\n`))
    } else {
      console.error(
        cliErr(
          `Germany PBF not found:\n  ${inputPbf}\n\n` +
            `Download with:\n  bun run extract:osm-pbf\n` +
            `Or set OSM_GERMANY_PBF / pass --pbf /path/to/germany-latest.osm.pbf`,
        ),
      )
      process.exit(1)
    }
  } else if (!dryRun) {
    const integ = checkOsmPbfIntegrity(inputPbf)
    if (!integ.ok) {
      const fix =
        integ.canDeleteCorruptCache === true
          ? `Re-download with:\n  bun run extract:osm-pbf -- --force`
          : `Install osmium on PATH, or use a machine where \`osmium fileinfo -e\` works on this file.`
      console.error(
        cliErr(`Germany PBF could not be validated:\n  ${inputPbf}\n${integ.detail}\n\n${fix}`),
      )
      process.exit(1)
    }
  }

  const filteredPbf = join(runtimeRoot, GERMANY_OSM_CACHE_DIR, GERMANY_OSM_FILTERED_BASENAME)
  const expressions = mergeTagsFilterExpressions(workspaceRoot, ordered)
  const osmHeaderTimestamp = readOsmPbfHeaderTimestamp(inputPbf, dryRun)

  let pbfForOgr = inputPbf

  if (!skipTagsFilter) {
    const runFilter = dryRun || shouldRunTagsFilter(inputPbf, filteredPbf, forceTagsFilter)
    if (runFilter) {
      console.log(
        cliHeadline(
          `Running osmium tags-filter → ${filteredPbf}\n  expressions: ${expressions.join(', ')}`,
        ),
      )
      runOsmiumTagsFilter(inputPbf, filteredPbf, expressions, dryRun)
    } else {
      console.log(cliMuted(`Reusing filtered PBF (up to date):\n  ${filteredPbf}`))
    }
    pbfForOgr = filteredPbf
  } else {
    console.log(
      cliWarn('Using full input PBF for ogr2ogr (--skip-tags-filter). This can be very slow.'),
    )
  }

  for (const kind of ordered) {
    const target = resolveExtractTarget(workspaceRoot, kind)
    const outFgb = join(runtimeRoot, GERMANY_OSM_CACHE_DIR, target.basename)
    console.log(
      cliHeadline(
        `\nShared OSM extract (${kind}) → ${join(GERMANY_OSM_CACHE_DIR, target.basename)}`,
      ),
    )
    runOgr2ogr(
      pbfForOgr,
      outFgb,
      target.sql,
      dryRun,
      target.geometryType ? { geometryType: target.geometryType } : undefined,
    )
    // The admin extract is the single source of truth for OSM provenance timestamps; the
    // candidate extracts are derived from the same PBF but do not need to update metadata.
    if (kind === 'admin') {
      writeOsmSourceMetadataForAreas(workspaceRoot, runtimeRoot, osmHeaderTimestamp, dryRun)
    }
  }

  console.log(cliOk('\nDone.'))
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2))
  if (parsed.help) {
    printHelp()
    return
  }

  const workspaceRoot = workspaceRootFromHere(import.meta.url)
  const runtimeRoot = runtimeRootFromWorkspace(workspaceRoot)
  const nonInteractive = parsed.nonInteractive || isCiEnv()
  const kinds: ExtractKind[] = parsed.kindExplicit
    ? [parsed.kind]
    : await resolveKindsWhenImplicit(nonInteractive)

  runSharedExtract(workspaceRoot, runtimeRoot, kinds, parsed)
}

void main().catch((err: unknown) => {
  console.error(cliErr('[extract:osm]'), err)
  process.exit(1)
})
