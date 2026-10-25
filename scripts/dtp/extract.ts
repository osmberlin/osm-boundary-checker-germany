#!/usr/bin/env bun
/**
 * Read the shared DtP cache (`.cache/dtp/`, filled by `bun run download:dtp`) and write, per DtP dataset
 * (`officialProfile: "dtp_protected_areas"` in `datasets/<area>/config.jsonc`):
 * `source/official.fgb` (WGS84 FlatGeobuf) and `source/metadata.json` (`official` side).
 *
 * No flags: every DtP dataset. `--area <folder>`: one dataset. `--yes` is accepted for pipeline parity.
 * Areas whose detail record is not cached yet (harvest still running) are skipped and counted in the log.
 */
import { spawnSync } from 'node:child_process'
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeSync,
} from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { z } from 'zod'
import { areaHasCompareConfig, loadAreaConfig } from '../shared/areaConfig.ts'
import {
  DATASETS_DIRECTORY,
  OFFICIAL_SOURCE_RELATIVE_PATH,
  datasetFolderPath,
} from '../shared/datasetPaths.ts'
import { DTP_OFFICIAL_SOURCE, type DtpSelection } from '../shared/dtpOfficial.ts'
import { runtimeRootFromWorkspace } from '../shared/runtimeRoot.ts'
import {
  type AreaSourceMetadataFile,
  datasetLicenseLabelForId,
  mergeAreaSourceMetadata,
} from '../shared/sourceMetadata.ts'
import {
  readAreaSourceMetadataFile,
  writeAreaSourceMetadataFile,
} from '../shared/sourceMetadataIo.ts'
import { workspaceRootFromHere } from '../shared/workspaceRoot.ts'
import { parseAreasNdjson } from './lib/areasCache.ts'
import {
  DTP_AREAS_FILE,
  DTP_CACHE_DIR,
  DTP_CATEGORIES_FILE,
  DTP_DOWNLOAD_METADATA,
  DTP_INVENTORY_FILE,
  DTP_ORGANIZATIONS_FILE,
} from './lib/constants.ts'
import {
  buildOfficialFeatures,
  selectInventoryItems,
  type DtpOfficialNames,
} from './lib/officialRows.ts'
import {
  dtpDownloadMetadataSchema,
  dtpInventorySchema,
  dtpOrganizationsFileSchema,
  type DtpCachedRecord,
  type DtpDownloadMetadata,
  type DtpInventory,
} from './lib/schemas.ts'

const categoriesFileSchema = z.array(z.object({ id: z.number().int(), name_de: z.string() }))

const GEOJSONSEQ_TMP = 'official.tmp.geojsonl'

function parseArgs(argv: string[]) {
  let area: string | null = null
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--area') {
      const v = argv[i + 1]
      if (v !== undefined) {
        area = v
        i++
      }
    }
  }
  return { area }
}

type DtpAreaSpec = { area: string; selection: DtpSelection }

function discoverDtpAreas(workspaceRoot: string): DtpAreaSpec[] {
  const datasetsRoot = join(workspaceRoot, DATASETS_DIRECTORY)
  if (!existsSync(datasetsRoot)) return []
  const out: DtpAreaSpec[] = []
  for (const entry of readdirSync(datasetsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue
    if (!areaHasCompareConfig(workspaceRoot, entry.name)) continue
    const config = loadAreaConfig(workspaceRoot, entry.name)
    if (config.officialMode !== 'dtp') continue
    out.push({ area: entry.name, selection: config.official.dtp })
  }
  return out.sort((a, b) => a.area.localeCompare(b.area))
}

function readCacheJson<T>(path: string, schema: z.ZodType<T>, hint: string): T {
  if (!existsSync(path)) {
    throw new Error(`Missing ${path}. ${hint}`)
  }
  return schema.parse(JSON.parse(readFileSync(path, 'utf-8')))
}

/**
 * Read only the cache records of `wanted` uuids. Walks the decompressed buffer line by line so a full
 * harvest (hundreds of MB of geometry) never becomes one string.
 */
function readCachedRecordsFor(
  path: string,
  wanted: ReadonlySet<string>,
): Map<string, DtpCachedRecord> {
  const out = new Map<string, DtpCachedRecord>()
  if (!existsSync(path)) return out
  const buf = gunzipSync(readFileSync(path))
  let invalid = 0
  let start = 0
  while (start < buf.length) {
    let end = buf.indexOf(10, start)
    if (end === -1) end = buf.length
    const line = buf.toString('utf-8', start, end)
    start = end + 1
    if (line.trim() === '') continue
    // Cheap pre-filter on the uuid before the full zod parse of the geometry.
    const m = /"uuid":"([^"]+)"/.exec(line)
    if (m && !wanted.has(m[1]!)) continue
    const { records, invalidCount } = parseAreasNdjson(line)
    invalid += invalidCount
    for (const record of records) {
      if (wanted.has(record.uuid)) out.set(record.uuid, record)
    }
  }
  if (invalid > 0) console.warn(`Skipped ${invalid} invalid line(s) in ${path}`)
  return out
}

function runOgr2ogr(inputGeoJsonSeq: string, outFgb: string): void {
  rmSync(outFgb, { force: true })
  const r = spawnSync(
    'ogr2ogr',
    ['-f', 'FlatGeobuf', '-nlt', 'MULTIPOLYGON', '-nln', 'official', outFgb, inputGeoJsonSeq],
    {
      encoding: 'utf-8',
      stdio: ['ignore', 'inherit', 'pipe'],
      env: { ...process.env, OGR_GEOMETRY_ACCEPT_UNCLOSED_RING: 'YES' },
    },
  )
  if (r.status !== 0) {
    const detail = (r.stderr ?? '').trim() || '(no stderr)'
    throw new Error(`ogr2ogr failed (exit ${r.status}): ${detail}`)
  }
}

function writeGeoJsonSeq(path: string, features: readonly unknown[]): void {
  const fd = openSync(path, 'w')
  try {
    for (const feature of features) writeSync(fd, `${JSON.stringify(feature)}\n`)
  } finally {
    closeSync(fd)
  }
}

function formatDuplicates(duplicates: Map<string, string[]>, limit = 10): string {
  const lines = [...duplicates]
    .slice(0, limit)
    .map(([wdpa, uuids]) => `  wdpa ${wdpa}: ${uuids.join(', ')}`)
  if (duplicates.size > limit) lines.push(`  ... and ${duplicates.size - limit} more`)
  return lines.join('\n')
}

function extractArea(
  spec: DtpAreaSpec,
  ctx: {
    runtimeRoot: string
    inventory: DtpInventory
    downloadMeta: DtpDownloadMetadata
    names: DtpOfficialNames
    areasPath: string
  },
): void {
  const { area, selection } = spec
  const started = Date.now()
  const selected = selectInventoryItems(ctx.inventory.items, selection)
  const records = readCachedRecordsFor(ctx.areasPath, new Set(selected.map((i) => i.uuid)))
  const { features, stats } = buildOfficialFeatures(
    ctx.inventory.items,
    records,
    selection,
    ctx.names,
  )

  const areaPath = datasetFolderPath(ctx.runtimeRoot, area)
  const outFgb = join(areaPath, OFFICIAL_SOURCE_RELATIVE_PATH)
  mkdirSync(dirname(outFgb), { recursive: true })
  const tmp = join(dirname(outFgb), GEOJSONSEQ_TMP)
  console.log(
    `${area}: categories [${selection.categoryIds.join(', ')}]${selection.requireWdpa ? ' with wdpa' : ''}: ` +
      `${stats.selectedInInventory} in inventory, ${stats.written} written, ` +
      `${stats.missingFromCache} not cached yet (skipped), ${stats.noGeometry} without geometry`,
  )
  if (stats.unknownOrganizationIds > 0) {
    console.warn(
      `${area}: ${stats.unknownOrganizationIds} responsible organization id(s) without a name in ${DTP_ORGANIZATIONS_FILE} (left out of dtp_organizations; run bun run download:dtp).`,
    )
  }
  if (stats.duplicateWdpa.size > 0) {
    console.log(
      `${area}: ${stats.duplicateWdpa.size} wdpa id(s) on more than one area (kept; compare unions same keys):\n` +
        formatDuplicates(stats.duplicateWdpa),
    )
  }
  if (features.length === 0) {
    throw new Error(
      `${area}: no DtP areas with geometry for this selection; run bun run download:dtp first (cache: ${relative(ctx.runtimeRoot, ctx.areasPath)}).`,
    )
  }

  try {
    writeGeoJsonSeq(tmp, features)
    runOgr2ogr(tmp, outFgb)
  } finally {
    rmSync(tmp, { force: true })
  }

  const missingNote =
    stats.missingFromCache > 0
      ? `DtP-Cache unvollstaendig: ${stats.missingFromCache} ausgewaehlte Gebiete ohne Geometrie uebersprungen.`
      : undefined
  const prev = readAreaSourceMetadataFile(areaPath) ?? {}
  const patch: AreaSourceMetadataFile = {
    official: {
      downloadedAt: ctx.downloadMeta.downloadedAt,
      sourceUpdatedAt: ctx.downloadMeta.sourceUpdatedAt,
      sourceUpdatedAtVerifiedAt: ctx.downloadMeta.sourceUpdatedAtVerifiedAt,
      sourceDateSource: 'dtp_api_updated_at',
      provider: DTP_OFFICIAL_SOURCE.provider,
      dataset: DTP_OFFICIAL_SOURCE.dataset,
      sourcePublicUrl: DTP_OFFICIAL_SOURCE.sourcePublicUrl,
      sourceDownloadUrl: DTP_OFFICIAL_SOURCE.sourceDownloadUrl,
      licenseId: DTP_OFFICIAL_SOURCE.licenseId,
      licenseLabel: datasetLicenseLabelForId(DTP_OFFICIAL_SOURCE.licenseId),
      licenseSourceUrl: DTP_OFFICIAL_SOURCE.licenseSourceUrl,
      osmCompatibility: DTP_OFFICIAL_SOURCE.osmCompatibility,
      osmCompatibilityComment: DTP_OFFICIAL_SOURCE.osmCompatibilityComment,
      // Keep a manually set note unless the cache is incomplete.
      ...(missingNote ? { note: missingNote } : {}),
    },
  }
  const merged = mergeAreaSourceMetadata(prev, patch)
  if (!missingNote && merged.official?.note?.startsWith('DtP-Cache unvollstaendig')) {
    delete merged.official.note
  }
  writeAreaSourceMetadataFile(areaPath, merged)
  console.log(
    `${area}: ${features.length} feature(s) -> ${relative(ctx.runtimeRoot, outFgb)} (${((Date.now() - started) / 1000).toFixed(1)}s)`,
  )
}

function main() {
  const workspaceRoot = workspaceRootFromHere(import.meta.url)
  const runtimeRoot = runtimeRootFromWorkspace(workspaceRoot)
  const { area } = parseArgs(process.argv.slice(2))

  const specs = discoverDtpAreas(workspaceRoot)
  const selected = area ? specs.filter((s) => s.area === area) : specs
  if (selected.length === 0) {
    console.error(
      area
        ? `Area "${area}" is not a DtP dataset (officialProfile "dtp_protected_areas") under ${DATASETS_DIRECTORY}/.`
        : `No DtP datasets under ${DATASETS_DIRECTORY}/.`,
    )
    process.exit(1)
  }

  const cacheDir = join(runtimeRoot, DTP_CACHE_DIR)
  const hint = 'Run bun run --filter ./scripts download:dtp first.'
  const inventory = readCacheJson(join(cacheDir, DTP_INVENTORY_FILE), dtpInventorySchema, hint)
  const downloadMeta = readCacheJson(
    join(cacheDir, DTP_DOWNLOAD_METADATA),
    dtpDownloadMetadataSchema,
    hint,
  )
  const categories = readCacheJson(join(cacheDir, DTP_CATEGORIES_FILE), categoriesFileSchema, hint)
  const organizations = readCacheJson(
    join(cacheDir, DTP_ORGANIZATIONS_FILE),
    dtpOrganizationsFileSchema,
    hint,
  )
  const names: DtpOfficialNames = {
    categories: new Map(categories.map((c) => [c.id, c.name_de])),
    organizations: new Map(organizations.organizations.map((o) => [o.id, o.name])),
  }
  const areasPath = join(cacheDir, DTP_AREAS_FILE)

  console.log(
    `DtP download-metadata.json: ${downloadMeta.cachedCount} of ${downloadMeta.inventoryCount} areas with detail` +
      (downloadMeta.pendingDetailCount > 0
        ? ` (${downloadMeta.pendingDetailCount} pending at last download run)`
        : ''),
  )
  for (const spec of selected) {
    extractArea(spec, { runtimeRoot, inventory, downloadMeta, names, areasPath })
  }
  console.log('Done.')
}

try {
  main()
} catch (e) {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
}
