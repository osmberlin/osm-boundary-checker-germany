#!/usr/bin/env bun
import { spawnSync } from 'node:child_process'
/**
 * Build one shared OSM FlatGeobuf for all compare runs:
 * administrative boundaries with non-empty `de:regionalschluessel`.
 *
 * Outputs:
 * - admin (`--kind admin`, default): `.cache/osm/germany-admin-boundaries-rs.fgb`
 * - plz (`--kind plz`): `.cache/osm/germany-postal-code-boundaries.fgb`
 *
 * Prerequisites: `osmium` and `ogr2ogr` on PATH; run `bun run osm:download` first
 * (or set `OSM_GERMANY_PBF` / `--pbf`).
 */
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { areaHasCompareConfig } from '../shared/areaConfig.ts'
import { DATASETS_DIRECTORY, datasetFolderPath } from '../shared/datasetPaths.ts'
import {
  DEFAULT_OSM_TAGS_FILTER_EXPRESSIONS,
  GERMANY_OSM_CACHE_DIR,
  GERMANY_OSM_FILTERED_BASENAME,
  GERMANY_OSM_PBF_BASENAME,
  GERMANY_OSM_SHARED_FGB_BASENAME,
  GERMANY_OSM_SHARED_PLZ_FGB_BASENAME,
} from '../shared/germanyOsmPbf.ts'
import { runtimeRootFromWorkspace } from '../shared/runtimeRoot.ts'
import { type AreaSourceMetadataFile, mergeAreaSourceMetadata } from '../shared/sourceMetadata.ts'
import {
  readAreaSourceMetadataFile,
  writeAreaSourceMetadataFile,
} from '../shared/sourceMetadataIo.ts'
import { workspaceRootFromHere } from '../shared/workspaceRoot.ts'
import { loadSharedAdminOsmExtractConfig } from './loadOsmExtractConfig.ts'

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

type ExtractKind = 'admin' | 'plz'

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

function parseArgs(argv: string[]) {
  let pbf: string | null = null
  let skipTagsFilter = false
  let forceTagsFilter = false
  let dryRun = false
  let kind: ExtractKind = 'admin'
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
    if (argv[i] === '--kind') {
      const v = argv[i + 1]?.trim().toLowerCase()
      if (v === 'admin' || v === 'plz') {
        kind = v
        i++
        continue
      }
      throw new Error(`--kind must be "admin" or "plz"`)
    }
    if (argv[i] === '--area') {
      console.warn('[osm:extract] --area is ignored; a single shared OSM FGB is always built.')
      const v = argv[i + 1]
      if (v !== undefined) i++
    }
  }
  return { pbf, skipTagsFilter, forceTagsFilter, dryRun, kind }
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

function runOgr2ogr(inputPbf: string, outFgb: string, sql: string, dryRun: boolean): void {
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

function readOsmPbfHeaderTimestamp(inputPbf: string, dryRun: boolean): string | null {
  if (dryRun) {
    console.log(`[dry-run] osmium fileinfo ${inputPbf} -g header.option.timestamp`)
    return null
  }
  const r = spawnSync('osmium', ['fileinfo', inputPbf, '-g', 'header.option.timestamp'], {
    encoding: 'utf-8',
  })
  if (r.status !== 0) {
    const detail = (r.stderr ?? '').trim()
    console.warn(
      `[osm:extract] Could not read OSM header timestamp via osmium fileinfo (${detail || `exit ${r.status}`}).`,
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
      '[osm:extract] OSM header timestamp unavailable; keeping existing osm.downloadedAt values.',
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
        `[dry-run] update ${DATASETS_DIRECTORY}/${area}/source/metadata.json (osm.downloadedAt=${patch.osm?.downloadedAt ?? 'unchanged'}, osm.extractedAt=would-write)`,
      )
      continue
    }
    writeAreaSourceMetadataFile(areaPath, mergeAreaSourceMetadata(prev, patch))
  }
}

function main() {
  const workspaceRoot = workspaceRootFromHere(import.meta.url)
  const runtimeRoot = runtimeRootFromWorkspace(workspaceRoot)
  const {
    pbf: pbfArg,
    skipTagsFilter,
    forceTagsFilter,
    dryRun,
    kind,
  } = parseArgs(process.argv.slice(2))

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
  const adminExtract = kind === 'admin' ? buildSharedAdminOgrSql(workspaceRoot) : null
  const expressions: string[] = [...DEFAULT_OSM_TAGS_FILTER_EXPRESSIONS]
  if (adminExtract) {
    expressions.splice(0, expressions.length, ...adminExtract.tagsFilterExpressions)
  }
  const osmHeaderTimestamp = readOsmPbfHeaderTimestamp(inputPbf, dryRun)

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

  const extractTargets: Record<ExtractKind, { basename: string; sql: string }> = {
    admin: {
      basename: GERMANY_OSM_SHARED_FGB_BASENAME,
      sql: adminExtract?.sql ?? '',
    },
    plz: { basename: GERMANY_OSM_SHARED_PLZ_FGB_BASENAME, sql: SHARED_OSM_PLZ_OGR_SQL },
  }
  if (kind === 'admin' && extractTargets.admin.sql === '') {
    throw new Error('Missing shared admin extract SQL configuration')
  }
  const target = extractTargets[kind]
  const outFgb = join(runtimeRoot, GERMANY_OSM_CACHE_DIR, target.basename)
  console.log(`\nShared OSM extract (${kind}) → ${join(GERMANY_OSM_CACHE_DIR, target.basename)}`)
  runOgr2ogr(pbfForOgr, outFgb, target.sql, dryRun)
  if (kind === 'admin') {
    writeOsmSourceMetadataForAreas(workspaceRoot, runtimeRoot, osmHeaderTimestamp, dryRun)
  }

  console.log('\nDone.')
}

main()
