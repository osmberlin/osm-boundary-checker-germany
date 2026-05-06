#!/usr/bin/env bun
// Config-driven HTTP official boundaries (WFS GeoJSON / GML, OGC API Features) → source/official.fgb.
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { areaHasCompareConfig, loadAreaConfig } from '../shared/areaConfig.ts'
import { parseAreaOfficialSourceFacts } from '../shared/areaConfigMetadata.ts'
import { emitCacheDecision } from '../shared/cacheDecision.ts'
import {
  DATASETS_DIRECTORY,
  OFFICIAL_SOURCE_RELATIVE_PATH,
  datasetFolderPath,
} from '../shared/datasetPaths.ts'
import { parseDownloadOfficial } from '../shared/downloadOfficialConfig.ts'
import { resolveHttpOfficialUpstream } from '../shared/officialUpstreamResolution.ts'
import { runtimeRootFromWorkspace } from '../shared/runtimeRoot.ts'
import {
  type AreaSourceMetadataFile,
  datasetLicenseLabelForId,
  type SourceMetadataSide,
  mergeAreaSourceMetadata,
} from '../shared/sourceMetadata.ts'
import {
  readAreaSourceMetadataFile,
  writeAreaSourceMetadataFile,
} from '../shared/sourceMetadataIo.ts'
import { workspaceRootFromHere } from '../shared/workspaceRoot.ts'

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

function parseArgs(argv: string[]) {
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
  return { area, force }
}

function logLine(parts: Record<string, string | number | undefined>): void {
  const tokens = Object.entries(parts)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${v}`)
  console.log(`[download] ${tokens.join(' ')}`)
}

function runOgr2ogrToFgb(sourcePathOrUrl: string, outFgb: string): void {
  const args = [
    '-f',
    'FlatGeobuf',
    '-t_srs',
    'EPSG:4326',
    '-nlt',
    'CONVERT_TO_LINEAR',
    '-nlt',
    'PROMOTE_TO_MULTI',
    outFgb,
    sourcePathOrUrl,
  ]
  const r = spawnSync('ogr2ogr', args, { encoding: 'utf-8', stdio: ['ignore', 'inherit', 'pipe'] })
  if (r.status !== 0) {
    const detail = (r.stderr ?? '').trim() || '(no stderr)'
    throw new Error(`ogr2ogr failed (exit ${r.status}): ${detail}`)
  }
}

function inferOfficialLicenseDefaults(sourceUrl: string): {
  licenseId?:
    | 'unknown'
    | 'odbl_10'
    | 'cc_by_30'
    | 'cc_by_40'
    | 'cc0_10'
    | 'dl_de_by_20'
    | 'dl_de_zero_20'
    | 'custom'
  licenseLabel?: string
  licenseSourceUrl?: string
  osmCompatibility?: 'unknown' | 'no' | 'yes_licence' | 'yes_waiver'
  osmCompatibilitySourceUrl?: string
} {
  if (sourceUrl.includes('gdi.berlin.de') || sourceUrl.includes('daten.berlin.de')) {
    return {
      licenseId: 'dl_de_zero_20',
      licenseLabel: datasetLicenseLabelForId('dl_de_zero_20'),
      licenseSourceUrl: 'https://www.govdata.de/dl-de/zero-2-0',
      osmCompatibility: 'yes_waiver',
      osmCompatibilitySourceUrl:
        'https://wiki.openstreetmap.org/w/images/3/34/2019-06-03_Datenlizenz_Deutschland_Berlin_OSM.pdf',
    }
  }
  if (sourceUrl.includes('geobasis-bb.de')) {
    return {
      licenseId: 'dl_de_by_20',
      licenseLabel: datasetLicenseLabelForId('dl_de_by_20'),
      licenseSourceUrl: 'https://www.govdata.de/dl-de/by-2-0',
      osmCompatibility: 'yes_waiver',
      osmCompatibilitySourceUrl:
        'https://wiki.openstreetmap.org/wiki/Brandenburg/Geoportal#Rechtliche_Grundlagen',
    }
  }
  if (sourceUrl.includes('api.hamburg.de')) {
    return {
      licenseId: 'dl_de_by_20',
      licenseLabel: datasetLicenseLabelForId('dl_de_by_20'),
      licenseSourceUrl: 'https://www.govdata.de/dl-de/by-2-0',
      osmCompatibility: 'no',
      osmCompatibilitySourceUrl: 'https://api.hamburg.de/datasets/v1/schulen',
    }
  }
  return {}
}

function buildOfficialPatchBase(params: {
  prevOfficial: Partial<SourceMetadataSide>
  defaults: Partial<SourceMetadataSide>
  inferredLicense: ReturnType<typeof inferOfficialLicenseDefaults>
  specUrl: string
  specFormat: 'geojson' | 'gml'
  specCrs?: string
  area: string
}): Omit<
  SourceMetadataSide,
  | 'sourceUpdatedAt'
  | 'sourceUpdatedAtVerifiedAt'
  | 'sourcePublishedAt'
  | 'downloadedAt'
  | 'sourceDateSource'
> {
  const { prevOfficial, defaults, inferredLicense, specUrl, specFormat, specCrs, area } = params
  const sourcePublicUrl = prevOfficial.sourcePublicUrl ?? defaults.sourcePublicUrl
  if (!sourcePublicUrl) {
    throw new Error(
      `Area "${area}": missing official.sourcePublicUrl in metadata/config — set official.source.sourcePublicUrl.`,
    )
  }
  return {
    layer: prevOfficial.layer ?? defaults.layer,
    provider: prevOfficial.provider ?? defaults.provider ?? 'HTTP',
    dataset:
      prevOfficial.dataset ??
      defaults.dataset ??
      (specFormat === 'geojson' ? 'GeoJSON' : 'WFS GML'),
    sourcePublicUrl,
    sourceDownloadUrl: prevOfficial.sourceDownloadUrl ?? defaults.sourceDownloadUrl ?? specUrl,
    licenseId:
      prevOfficial.licenseId ?? defaults.licenseId ?? inferredLicense.licenseId ?? 'unknown',
    licenseLabel:
      prevOfficial.licenseLabel ??
      defaults.licenseLabel ??
      inferredLicense.licenseLabel ??
      'unknown',
    licenseSourceUrl:
      prevOfficial.licenseSourceUrl ??
      defaults.licenseSourceUrl ??
      inferredLicense.licenseSourceUrl,
    osmCompatibility:
      prevOfficial.osmCompatibility ??
      defaults.osmCompatibility ??
      inferredLicense.osmCompatibility ??
      'unknown',
    osmCompatibilitySourceUrl:
      prevOfficial.osmCompatibilitySourceUrl ??
      defaults.osmCompatibilitySourceUrl ??
      inferredLicense.osmCompatibilitySourceUrl,
    osmCompatibilityComment:
      prevOfficial.osmCompatibilityComment ?? defaults.osmCompatibilityComment,
    note: prevOfficial.note ?? defaults.note ?? (specCrs ? `Declared CRS: ${specCrs}` : undefined),
    license: prevOfficial.license ?? defaults.license,
  }
}

type OfficialDownloadResult = 'ok' | 'skip' | 'fail' | 'fail_upstream'
type DownloadFailure = {
  area: string
  reason: string
  detail?: string
}

async function processArea(
  configRoot: string,
  runtimeRoot: string,
  area: string,
  force: boolean,
  failures: DownloadFailure[],
): Promise<OfficialDownloadResult> {
  const areaPath = datasetFolderPath(runtimeRoot, area)
  let raw: unknown
  try {
    raw = loadAreaConfig(configRoot, area)
  } catch (e) {
    logLine({
      area,
      source: 'official',
      status: 'fail',
      reason: 'config',
      detail: String(e),
    })
    failures.push({ area, reason: 'config', detail: String(e) })
    return 'fail'
  }

  let spec: ReturnType<typeof parseDownloadOfficial>
  try {
    spec = parseDownloadOfficial(raw)
  } catch (e) {
    logLine({
      area,
      source: 'official',
      status: 'fail',
      reason: 'invalid_download_config',
      detail: String(e),
    })
    failures.push({ area, reason: 'invalid_download_config', detail: String(e) })
    return 'fail'
  }

  if (!spec) {
    emitCacheDecision({
      source: 'official',
      area,
      decision: 'not-found',
      reason: 'no_download_config',
      action: 'skip',
      detail: 'area has compare config but no official.download source configured',
    })
    logLine({ area, source: 'official', status: 'skip', reason: 'no_download_config' })
    return 'skip'
  }

  const outAbs = join(areaPath, OFFICIAL_SOURCE_RELATIVE_PATH)
  const prev: AreaSourceMetadataFile = readAreaSourceMetadataFile(areaPath) ?? {}
  const prevOfficial: Partial<SourceMetadataSide> = prev.official ?? {}
  const inferredLicense = inferOfficialLicenseDefaults(spec.url)
  const defaults = parseAreaOfficialSourceFacts(area, raw) ?? {}

  let resolved
  try {
    resolved = await resolveHttpOfficialUpstream(spec)
  } catch (error) {
    logLine({
      area,
      source: 'official',
      status: 'fail',
      reason: 'upstream_resolve_failed',
      detail: String(error),
    })
    failures.push({ area, reason: 'upstream_resolve_failed', detail: String(error) })
    return 'fail_upstream'
  }

  const verifiedAt = new Date().toISOString()
  const prevStand = prevOfficial.sourceUpdatedAt?.trim()
  const geometryExists = existsSync(outAbs)
  const standMatches = prevStand === resolved.sourceUpdatedAt.trim()
  const hasPersistedGeometryFetchTime = Boolean(prevOfficial.downloadedAt?.trim())
  const canReuseGeometry = !force && geometryExists && standMatches && hasPersistedGeometryFetchTime

  if (canReuseGeometry) {
    emitCacheDecision({
      source: 'official',
      area,
      decision: 'hit',
      reason: 'source_updated_at_unchanged',
      action: 'reuse',
      detail: resolved.sourceDateSource,
    })
    logLine({
      area,
      source: 'official',
      status: 'skip',
      reason: 'geometry_cache_hit',
      detail: resolved.sourceDateSource,
    })

    try {
      const basePatch = buildOfficialPatchBase({
        prevOfficial,
        defaults,
        inferredLicense,
        specUrl: spec.url,
        specFormat: spec.format,
        specCrs: spec.crs,
        area,
      })
      const patch: AreaSourceMetadataFile = {
        official: {
          ...basePatch,
          sourceUpdatedAt: resolved.sourceUpdatedAt,
          sourcePublishedAt: resolved.sourcePublishedAt ?? prevOfficial.sourcePublishedAt,
          sourceUpdatedAtVerifiedAt: verifiedAt,
          downloadedAt: prevOfficial.downloadedAt,
          sourceDateSource: resolved.sourceDateSource,
        },
      }
      writeAreaSourceMetadataFile(areaPath, mergeAreaSourceMetadata(prev, patch))
    } catch (e) {
      logLine({
        area,
        source: 'official',
        status: 'fail',
        reason: 'metadata_write',
        detail: String(e),
      })
      failures.push({ area, reason: 'metadata_write', detail: String(e) })
      return 'fail'
    }
    return 'skip'
  }

  emitCacheDecision({
    source: 'official',
    area,
    decision: force ? 'forced-refresh' : standMatches ? 'miss' : 'stale',
    reason: force
      ? 'force_flag'
      : !geometryExists
        ? 'missing_geometry'
        : 'source_updated_at_changed',
    action: 'refresh',
    detail: resolved.sourceDateSource,
  })

  const t0 = Date.now()
  logLine({ area, source: 'official', status: 'start', format: spec.format })

  const tmpName = `official-${area}-${randomBytes(8).toString('hex')}.geojson`
  const tmpPath = join(tmpdir(), tmpName)
  const outTmp = `${outAbs}.tmp-${randomBytes(4).toString('hex')}.fgb`

  try {
    mkdirSync(join(outAbs, '..'), { recursive: true })

    if (spec.format === 'geojson') {
      const res = await fetch(spec.url, {
        headers: { Accept: 'application/geo+json, application/json, */*' },
      })
      if (!res.ok) {
        logLine({
          area,
          source: 'official',
          status: 'fail',
          ms: Date.now() - t0,
          reason: `http_${res.status}`,
        })
        failures.push({ area, reason: `http_${res.status}` })
        return 'fail'
      }
      const buf = new Uint8Array(await res.arrayBuffer())
      writeFileSync(tmpPath, buf)
      runOgr2ogrToFgb(tmpPath, outTmp)
    } else {
      runOgr2ogrToFgb(spec.url, outTmp)
    }
    rmSync(outAbs, { recursive: true, force: true })
    renameSync(outTmp, outAbs)

    const downloadedAt = new Date().toISOString()
    const basePatch = buildOfficialPatchBase({
      prevOfficial,
      defaults,
      inferredLicense,
      specUrl: spec.url,
      specFormat: spec.format,
      specCrs: spec.crs,
      area,
    })
    const patch: AreaSourceMetadataFile = {
      official: {
        ...basePatch,
        sourceUpdatedAt: resolved.sourceUpdatedAt,
        sourcePublishedAt: resolved.sourcePublishedAt ?? prevOfficial.sourcePublishedAt,
        sourceUpdatedAtVerifiedAt: verifiedAt,
        downloadedAt,
        sourceDateSource: resolved.sourceDateSource,
      },
    }
    writeAreaSourceMetadataFile(areaPath, mergeAreaSourceMetadata(prev, patch))

    logLine({
      area,
      source: 'official',
      status: 'ok',
      ms: Date.now() - t0,
      reason: resolved.sourceDateSource,
    })
    return 'ok'
  } catch (e) {
    logLine({
      area,
      source: 'official',
      status: 'fail',
      ms: Date.now() - t0,
      detail: String(e),
    })
    failures.push({ area, reason: 'geometry_fetch_or_convert', detail: String(e) })
    return 'fail'
  } finally {
    try {
      if (existsSync(tmpPath)) unlinkSync(tmpPath)
    } catch {
      /* ignore */
    }
    try {
      if (existsSync(outTmp)) rmSync(outTmp, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  }
}

async function main() {
  const workspaceRoot = workspaceRootFromHere(import.meta.url)
  const runtimeRoot = runtimeRootFromWorkspace(workspaceRoot)
  const { area: onlyArea, force } = parseArgs(process.argv.slice(2))
  const areas = discoverAreas(workspaceRoot)
  if (areas.length === 0) {
    console.error(`No areas with compare config under ${DATASETS_DIRECTORY}/`)
    process.exit(1)
  }

  const selected = onlyArea ? areas.filter((a) => a === onlyArea) : areas
  if (onlyArea && selected.length === 0) {
    console.error(`Unknown area: ${onlyArea}`)
    process.exit(1)
  }

  const failures: DownloadFailure[] = []
  let hardFail = false
  let upstreamFail = false
  for (const a of selected) {
    const r = await processArea(workspaceRoot, runtimeRoot, a, force, failures)
    if (r === 'fail') hardFail = true
    if (r === 'fail_upstream') upstreamFail = true
  }
  if (failures.length > 0) {
    const lines = failures.map(
      (f) => `- ${f.area}: ${f.reason}${f.detail ? ` :: ${f.detail}` : ''}`,
    )
    console.error(
      `[download:official] failed for ${failures.length} area(s):\n` +
        `${lines.join('\n')}\n` +
        'Hint: inspect official.download upstreamDateResolver strategies in scripts/shared/downloadOfficialConfig.ts.',
    )
  }
  process.exit(hardFail || upstreamFail ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
