#!/usr/bin/env bun
import { spawnSync } from 'node:child_process'
/**
 * Build the shared OSM FlatGeobufs all compare runs depend on.
 *
 * Without `--kind`: interactive multiselect (TTY) defaulting to admin + admin_candidates;
 * `--yes` / `--non-interactive` / non-TTY (stdin) runs those two without prompts (`--help`).
 *
 * With `--kind <name>`: one extract only, non-interactive (same as before).
 *
 * Outputs (one per selected kind):
 * - admin:              `.cache/osm/` + `GERMANY_OSM_SHARED_FGB_BASENAME` (keyed polygons)
 * - plz:                `.cache/osm/germany-postal-code-boundaries.fgb` (keyed polygons)
 * - admin_candidates:   `.cache/osm/germany-admin-candidates.fgb` (POINTS — point-on-surface
 *                       for `match_candidates` / OSM-Kandidaten UI)
 * - plz_candidates:     `.cache/osm/germany-postal-code-candidates.fgb` (POINTS)
 * - protected_areas:   `.cache/osm/germany-protected-areas-wdpa.fgb` (all protected-area polygons; the key join uses `ref:WDPA`)
 * - protected_areas_candidates: `.cache/osm/germany-protected-areas-candidates.fgb` (POINTS)
 *
 * Prerequisites: `osmium` and `ogr2ogr` on PATH; run `bun run download -- --yes --targets pbf` first
 * (or set `OSM_GERMANY_PBF` / `--pbf`). The candidate extracts use SpatiaLite's
 * `ST_PointOnSurface` (verified available in GDAL 3.12) so the geometry is collapsed
 * to a single inside point at extract time.
 */
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as p from '@clack/prompts'
import { emitRegionalOsmTagsSidecar } from '../report/emitRegionalOsmTags.ts'
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
  GERMANY_OSM_PROTECTED_AREAS_CANDIDATES_FGB_BASENAME,
  GERMANY_OSM_PROTECTED_AREAS_FILTERED_BASENAME,
  GERMANY_OSM_PROTECTED_AREAS_WDPA_FGB_BASENAME,
  GERMANY_OSM_SHARED_FGB_BASENAME,
  GERMANY_OSM_SHARED_PLZ_FGB_BASENAME,
  PROTECTED_AREAS_OSM_TAGS_FILTER_EXPRESSIONS,
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

/**
 * GDAL OSM `multipolygons` layer: there is **no** `osm_type` column. With `osm_id=yes` in
 * `osmconf.ini`, upstream GDAL adds **`osm_way_id`** alongside **`osm_id`**: closed-way
 * polygons set `osm_way_id` only; relation-built multipolygons set `osm_id` only (mutually
 * exclusive — see GDAL’s default `osmconf.ini` comment on `[multipolygons]`).
 *
 * We materialize Overpass-style `@id` (`way/…` / `relation/…`) from those two fields only,
 * without inferring primitive type from OSM’s `type=*` tag or from `osm_id` sign.
 */
const OSM_MULTIPOLYGON_AT_ID_SQL = `
  CASE
    WHEN osm_way_id IS NOT NULL
         AND TRIM(CAST(osm_way_id AS TEXT)) <> ''
         AND ABS(CAST(osm_way_id AS INTEGER)) > 0
      THEN 'way/' || CAST(ABS(CAST(osm_way_id AS INTEGER)) AS TEXT)
    WHEN osm_id IS NOT NULL
         AND TRIM(CAST(osm_id AS TEXT)) <> ''
         AND CAST(osm_id AS REAL) <> 0
      THEN 'relation/' || CAST(ABS(CAST(osm_id AS INTEGER)) AS TEXT)
    ELSE NULL
  END AS "@id"`.trim()

const SHARED_OSM_PLZ_OGR_SQL = `
SELECT
  geometry,
  osm_id,
  osm_way_id,
  ${OSM_MULTIPOLYGON_AT_ID_SQL},
  postal_code
FROM multipolygons
WHERE boundary = 'postal_code'
  AND postal_code IS NOT NULL
  AND postal_code <> ''
`.trim()

const SHARED_OSM_PLZ_CANDIDATES_OGR_SQL = `
SELECT
  ST_PointOnSurface(geometry) AS geometry,
  osm_id,
  osm_way_id,
  "name",
  "postal_code"
FROM multipolygons
WHERE boundary = 'postal_code'
`.trim()

/** Tags that make a multipolygon a protected area (the union the tags-filter selects). */
const PROTECTED_AREAS_WHERE_SQL = `
WHERE boundary IN ('protected_area', 'national_park')
  OR leisure = 'nature_reserve'
  OR "protect_class" IS NOT NULL
  OR "protection_title" IS NOT NULL
  OR "ref:WDPA" IS NOT NULL
`.trim()

/**
 * Every protected-area multipolygon, with or without `ref:WDPA`. Same `osm_id` / `osm_way_id` /
 * `@id` handling as the admin extract. Feeds the `protected_area_wdpa` osmProfile: the key join
 * only uses features with a valid `ref:WDPA`; the others are reachable by `@id` / `dtp_id` for the
 * identity fallback (the DtP OSM reference).
 */
const PROTECTED_AREAS_WDPA_OGR_SQL = `
SELECT
  geometry,
  osm_id,
  osm_way_id,
  ${OSM_MULTIPOLYGON_AT_ID_SQL},
  "name",
  "ref:WDPA",
  "wikidata",
  "boundary",
  "leisure",
  "protect_class",
  "protection_title",
  "ref:SCI",
  "ref:natura2000",
  "ref:DE",
  "operator",
  "dtp_id"
FROM multipolygons
${PROTECTED_AREAS_WHERE_SQL}
`.trim()

/** Every protected-area multipolygon (no `ref:WDPA` requirement), collapsed to one inside point. */
const PROTECTED_AREAS_CANDIDATES_OGR_SQL = `
SELECT
  ST_PointOnSurface(geometry) AS geometry,
  osm_id,
  osm_way_id,
  "name",
  "ref:WDPA",
  "wikidata",
  "boundary",
  "leisure",
  "protect_class",
  "protection_title",
  "ref:SCI",
  "ref:natura2000",
  "ref:DE",
  "operator",
  "dtp_id"
FROM multipolygons
${PROTECTED_AREAS_WHERE_SQL}
`.trim()

type ExtractKind =
  | 'admin'
  | 'plz'
  | 'admin_candidates'
  | 'plz_candidates'
  | 'protected_areas'
  | 'protected_areas_candidates'

/** Stable run order when multiple `--kind` steps run in one invocation. */
const EXTRACT_KIND_ORDER: ExtractKind[] = [
  'admin',
  'admin_candidates',
  'plz',
  'plz_candidates',
  'protected_areas',
  'protected_areas_candidates',
]

/** Kinds that read the protected-area tags-filter PBF instead of the administrative one. */
function isProtectedAreaKind(kind: ExtractKind): boolean {
  return kind === 'protected_areas' || kind === 'protected_areas_candidates'
}

function sortKinds(kinds: ExtractKind[]): ExtractKind[] {
  return EXTRACT_KIND_ORDER.filter((k) => kinds.includes(k))
}

function mergeTagsFilterExpressions(workspaceRoot: string, kinds: ExtractKind[]): string[] {
  const merged = new Set<string>(DEFAULT_OSM_TAGS_FILTER_EXPRESSIONS)
  for (const kind of kinds) {
    switch (kind) {
      case 'admin':
        for (const expr of buildSharedAdminOgrSql(workspaceRoot).tagsFilterExpressions) {
          merged.add(expr)
        }
        break
      case 'admin_candidates':
        for (const expr of buildSharedAdminCandidatesOgrSql(workspaceRoot).tagsFilterExpressions) {
          merged.add(expr)
        }
        break
      case 'plz':
      case 'plz_candidates':
      case 'protected_areas':
      case 'protected_areas_candidates':
        break
    }
  }
  return Array.from(merged)
}

function printHelp(): void {
  console.log(`Usage: bun run --filter ./scripts extract:osm [options]

Build shared OSM FlatGeobuf file(s) under ${GERMANY_OSM_CACHE_DIR}/.

When --kind is omitted:
  • Interactive TTY: multiselect (@clack/prompts); default selection = admin + admin_candidates.
  • --yes, --non-interactive, or non-TTY stdin: runs admin and admin_candidates without prompts.

When --kind is set: runs that single kind only (no prompts), same as before.

Options:
  --kind admin|plz|admin_candidates|plz_candidates|protected_areas|protected_areas_candidates
                                                     Single extract (non-interactive)
  --pbf <path>                                       Input PBF (else OSM_GERMANY_PBF or default cache path)
  --skip-tags-filter / --force-tags-filter / --dry-run
  --yes / --non-interactive                          Skip prompts when --kind is omitted (default kinds: admin + admin_candidates)
  -h, --help                                         This text

Outputs (basenames from shared constants in code):
  admin               Keyed administrative multipolygons → ${GERMANY_OSM_SHARED_FGB_BASENAME}
  admin_candidates    Point-on-surface admin layer → ${GERMANY_OSM_ADMIN_CANDIDATES_FGB_BASENAME}
  plz                 Postal polygons → ${GERMANY_OSM_SHARED_PLZ_FGB_BASENAME}
  plz_candidates      Postal candidate points → ${GERMANY_OSM_PLZ_CANDIDATES_FGB_BASENAME}
  protected_areas     Protected-area polygons (key join on ref:WDPA) → ${GERMANY_OSM_PROTECTED_AREAS_WDPA_FGB_BASENAME}
  protected_areas_candidates
                      Protected-area candidate points → ${GERMANY_OSM_PROTECTED_AREAS_CANDIDATES_FGB_BASENAME}
`)
}

async function resolveKindsWhenImplicit(nonInteractive: boolean): Promise<ExtractKind[]> {
  const defaultPair: ExtractKind[] = ['admin', 'admin_candidates']
  if (nonInteractive || !process.stdin.isTTY) {
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
      {
        value: 'protected_areas',
        label: 'protected_areas — Schutzgebiete (Polygone)',
        hint: `${GERMANY_OSM_PROTECTED_AREAS_WDPA_FGB_BASENAME} · protected-area multipolygons`,
      },
      {
        value: 'protected_areas_candidates',
        label: 'protected_areas_candidates — Schutzgebiete (Punkte)',
        hint: `${GERMANY_OSM_PROTECTED_AREAS_CANDIDATES_FGB_BASENAME} · all protected-area multipolygons as points`,
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
    'osm_way_id',
    OSM_MULTIPOLYGON_AT_ID_SQL,
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
       osm_way_id,
       "type",
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
      if (
        v === 'admin' ||
        v === 'plz' ||
        v === 'admin_candidates' ||
        v === 'plz_candidates' ||
        v === 'protected_areas' ||
        v === 'protected_areas_candidates'
      ) {
        kind = v
        i++
        continue
      }
      throw new Error(
        `--kind must be "admin", "plz", "admin_candidates", "plz_candidates", "protected_areas", or "protected_areas_candidates"`,
      )
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

/**
 * Returns the PBF that ogr2ogr should read: the filtered intermediate (created or reused), or the
 * full input when `--skip-tags-filter` is set.
 */
function prepareFilteredPbf(args: {
  inputPbf: string
  filteredPbf: string
  expressions: string[]
  skipTagsFilter: boolean
  forceTagsFilter: boolean
  dryRun: boolean
}): string {
  if (args.skipTagsFilter) {
    console.log(
      cliWarn('Using full input PBF for ogr2ogr (--skip-tags-filter). This can be very slow.'),
    )
    return args.inputPbf
  }
  const runFilter =
    args.dryRun || shouldRunTagsFilter(args.inputPbf, args.filteredPbf, args.forceTagsFilter)
  if (runFilter) {
    console.log(
      cliHeadline(
        `Running osmium tags-filter → ${args.filteredPbf}\n  expressions: ${args.expressions.join(', ')}`,
      ),
    )
    runOsmiumTagsFilter(args.inputPbf, args.filteredPbf, args.expressions, args.dryRun)
  } else {
    console.log(cliMuted(`Reusing filtered PBF (up to date):\n  ${args.filteredPbf}`))
  }
  return args.filteredPbf
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

function readOsmHeaderTimestampForExtract(inputPbf: string, dryRun: boolean): string | null {
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
  if (kind === 'protected_areas') {
    return {
      basename: GERMANY_OSM_PROTECTED_AREAS_WDPA_FGB_BASENAME,
      sql: PROTECTED_AREAS_WDPA_OGR_SQL,
    }
  }
  if (kind === 'protected_areas_candidates') {
    return {
      basename: GERMANY_OSM_PROTECTED_AREAS_CANDIDATES_FGB_BASENAME,
      sql: PROTECTED_AREAS_CANDIDATES_OGR_SQL,
      geometryType: 'POINT',
    }
  }
  return {
    basename: GERMANY_OSM_PLZ_CANDIDATES_FGB_BASENAME,
    sql: SHARED_OSM_PLZ_CANDIDATES_OGR_SQL,
    geometryType: 'POINT',
  }
}

async function runSharedExtract(
  workspaceRoot: string,
  runtimeRoot: string,
  kinds: ExtractKind[],
  parsed: {
    pbf: string | null
    skipTagsFilter: boolean
    forceTagsFilter: boolean
    dryRun: boolean
  },
): Promise<void> {
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
            `Download with:\n  bun run download -- --yes --targets pbf\n` +
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
          ? `Re-download with:\n  bun run download -- --yes --targets pbf --force`
          : `Install osmium on PATH, or use a machine where \`osmium fileinfo -e\` works on this file.`
      console.error(
        cliErr(`Germany PBF could not be validated:\n  ${inputPbf}\n${integ.detail}\n\n${fix}`),
      )
      process.exit(1)
    }
  }

  const osmHeaderTimestamp = readOsmHeaderTimestampForExtract(inputPbf, dryRun)

  // Admin-family kinds share one filtered PBF. Protected-area kinds use their own intermediate
  // PBF, because their tags-filter expressions do not overlap the administrative one.
  const pbfForKind = new Map<ExtractKind, string>()
  const adminKinds = ordered.filter((kind) => !isProtectedAreaKind(kind))
  const protectedKinds = ordered.filter((kind) => isProtectedAreaKind(kind))
  if (adminKinds.length > 0) {
    const pbf = prepareFilteredPbf({
      inputPbf,
      filteredPbf: join(runtimeRoot, GERMANY_OSM_CACHE_DIR, GERMANY_OSM_FILTERED_BASENAME),
      expressions: mergeTagsFilterExpressions(workspaceRoot, adminKinds),
      skipTagsFilter,
      forceTagsFilter,
      dryRun,
    })
    for (const kind of adminKinds) pbfForKind.set(kind, pbf)
  }
  if (protectedKinds.length > 0) {
    const pbf = prepareFilteredPbf({
      inputPbf,
      filteredPbf: join(
        runtimeRoot,
        GERMANY_OSM_CACHE_DIR,
        GERMANY_OSM_PROTECTED_AREAS_FILTERED_BASENAME,
      ),
      expressions: [...PROTECTED_AREAS_OSM_TAGS_FILTER_EXPRESSIONS],
      skipTagsFilter,
      forceTagsFilter,
      dryRun,
    })
    for (const kind of protectedKinds) pbfForKind.set(kind, pbf)
  }

  for (const kind of ordered) {
    const target = resolveExtractTarget(workspaceRoot, kind)
    const outFgb = join(runtimeRoot, GERMANY_OSM_CACHE_DIR, target.basename)
    console.log(
      cliHeadline(
        `\nShared OSM extract (${kind}) → ${join(GERMANY_OSM_CACHE_DIR, target.basename)}`,
      ),
    )
    const pbfForOgr = pbfForKind.get(kind)
    if (pbfForOgr == null) throw new Error(`No input PBF prepared for --kind ${kind}`)
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
      if (!dryRun) {
        const sidecar = await emitRegionalOsmTagsSidecar(runtimeRoot, outFgb)
        if (sidecar) {
          console.log(
            cliMuted(
              `Regional OSM tag sidecar: ${sidecar.arsCount} ARS from ${sidecar.featureCount} features → ${sidecar.path}`,
            ),
          )
        }
      }
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
  const nonInteractive = parsed.nonInteractive
  const kinds: ExtractKind[] = parsed.kindExplicit
    ? [parsed.kind]
    : await resolveKindsWhenImplicit(nonInteractive)

  await runSharedExtract(workspaceRoot, runtimeRoot, kinds, parsed)
}

void main().catch((err: unknown) => {
  console.error(cliErr('[extract:osm]'), err)
  process.exit(1)
})
