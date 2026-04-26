#!/usr/bin/env bun
// Config-driven HTTP official boundaries (WFS GeoJSON / GML) → official.path FlatGeobuf. Requires ogr2ogr.
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { areaHasCompareConfig, loadAreaConfig } from '../shared/areaConfig.ts'
import { parseAreaOfficialSourceFacts } from '../shared/areaConfigMetadata.ts'
import { decideDailyRefresh, resolveRefreshTimezone } from '../shared/dailyRefreshWindow.ts'
import { DATASETS_DIRECTORY, datasetFolderPath } from '../shared/datasetPaths.ts'
import { parseDownloadOfficial } from '../shared/downloadOfficialConfig.ts'
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
import { extractWfsDateMetadata } from '../shared/wfsSourceMetadata.ts'
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
    // Turf/compare expects linear polygonal geometry, not CurvePolygon.
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
      licenseSourceUrl: 'https://api.hamburg.de/datasets/v1/schulen',
      osmCompatibility: 'no',
      osmCompatibilitySourceUrl: 'https://api.hamburg.de/datasets/v1/schulen',
    }
  }
  return {}
}

async function processArea(
  configRoot: string,
  runtimeRoot: string,
  area: string,
  force: boolean,
  timezone: string,
): Promise<'ok' | 'skip' | 'fail'> {
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
    return 'fail'
  }

  if (!spec) {
    logLine({ area, source: 'official', status: 'skip', reason: 'no_download_config' })
    return 'skip'
  }

  const doc = raw as Record<string, unknown>
  const officialCfg = doc.official as Record<string, unknown> | undefined
  const relPath = officialCfg && typeof officialCfg.path === 'string' ? officialCfg.path.trim() : ''
  if (!relPath) {
    logLine({ area, source: 'official', status: 'fail', reason: 'missing_official.path' })
    return 'fail'
  }

  const outAbs = join(areaPath, relPath)
  const cacheExists = existsSync(outAbs)
  const cachedAt = cacheExists ? statSync(outAbs).mtime.toISOString() : undefined
  const decision = decideDailyRefresh({
    force,
    cacheExists,
    cachedAt,
    timezone,
  })
  if (!decision.shouldDownload) {
    logLine({
      area,
      source: 'official',
      status: 'skip',
      reason: 'cache_used',
      detail: decision.because,
      timezone: decision.timezone,
      currentWindow: decision.currentWindowKey,
      cachedWindow: decision.cachedWindowKey,
    })
    return 'skip'
  }
  if (decision.reason === 'cache_stale_previous_window') {
    logLine({
      area,
      source: 'official',
      status: 'info',
      reason: 'download_required',
      detail: decision.because,
      timezone: decision.timezone,
      currentWindow: decision.currentWindowKey,
      cachedWindow: decision.cachedWindowKey,
    })
  }

  const t0 = Date.now()
  logLine({ area, source: 'official', status: 'start', format: spec.format })

  const tmpName = `official-${area}-${randomBytes(8).toString('hex')}.geojson`
  const tmpPath = join(tmpdir(), tmpName)

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
        return 'fail'
      }
      const buf = new Uint8Array(await res.arrayBuffer())
      writeFileSync(tmpPath, buf)
      runOgr2ogrToFgb(tmpPath, outAbs)
    } else {
      // WFS GML responses are not always JSON-fetchable in-process; let GDAL read from URL directly.
      runOgr2ogrToFgb(spec.url, outAbs)
    }

    const prev: AreaSourceMetadataFile = readAreaSourceMetadataFile(areaPath) ?? {}
    let extractedWfsDates: Awaited<ReturnType<typeof extractWfsDateMetadata>> = {}
    try {
      extractedWfsDates = await extractWfsDateMetadata(spec.url)
      if (extractedWfsDates.sourcePublishedAt || extractedWfsDates.sourceUpdatedAt) {
        logLine({
          area,
          source: 'official',
          status: 'info',
          reason: 'wfs_dates_detected',
          updatedAt: extractedWfsDates.sourceUpdatedAt,
          publishedAt: extractedWfsDates.sourcePublishedAt,
        })
      }
    } catch (error) {
      logLine({
        area,
        source: 'official',
        status: 'info',
        reason: 'wfs_metadata_fetch_failed',
        detail: String(error),
      })
    }
    const downloadedAt = new Date().toISOString()
    const prevOfficial: Partial<SourceMetadataSide> = prev.official ?? {}
    const inferredLicense = inferOfficialLicenseDefaults(spec.url)
    const defaults = parseAreaOfficialSourceFacts(area, raw) ?? {}
    const sourcePublicUrl = prevOfficial.sourcePublicUrl ?? defaults.sourcePublicUrl
    if (!sourcePublicUrl) {
      logLine({
        area,
        source: 'official',
        status: 'fail',
        reason: 'missing_source_public_url',
        detail:
          'Set official.sourcePublicUrl in source/metadata.json (or official.source.sourcePublicUrl).',
      })
      return 'fail'
    }
    const nextSourcePublishedAt =
      prevOfficial.sourcePublishedAt ?? extractedWfsDates.sourcePublishedAt
    const nextSourceUpdatedAt = prevOfficial.sourceUpdatedAt ?? extractedWfsDates.sourceUpdatedAt
    const nextSourceDateSource =
      prevOfficial.sourceDateSource ??
      (nextSourcePublishedAt || nextSourceUpdatedAt
        ? extractedWfsDates.sourceDateSource
        : undefined)
    const patch = {
      official: {
        downloadedAt,
        provider: prevOfficial.provider ?? defaults.provider ?? 'HTTP',
        dataset:
          prevOfficial.dataset ??
          defaults.dataset ??
          (spec.format === 'geojson' ? 'GeoJSON' : 'WFS GML'),
        sourcePublicUrl,
        sourceDownloadUrl: prevOfficial.sourceDownloadUrl ?? defaults.sourceDownloadUrl ?? spec.url,
        sourcePublishedAt: nextSourcePublishedAt,
        sourceUpdatedAt: nextSourceUpdatedAt,
        sourceDateSource: nextSourceDateSource,
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
        note:
          prevOfficial.note ??
          defaults.note ??
          (spec.crs ? `Declared CRS: ${spec.crs}` : undefined),
        license: prevOfficial.license ?? defaults.license,
      },
    }
    writeAreaSourceMetadataFile(areaPath, mergeAreaSourceMetadata(prev, patch))

    logLine({ area, source: 'official', status: 'ok', ms: Date.now() - t0 })
    return 'ok'
  } catch (e) {
    logLine({
      area,
      source: 'official',
      status: 'fail',
      ms: Date.now() - t0,
      detail: String(e),
    })
    return 'fail'
  } finally {
    try {
      if (existsSync(tmpPath)) unlinkSync(tmpPath)
    } catch {
      /* ignore */
    }
  }
}

async function main() {
  const workspaceRoot = workspaceRootFromHere(import.meta.url)
  const runtimeRoot = runtimeRootFromWorkspace(workspaceRoot)
  const { area: onlyArea, force } = parseArgs(process.argv.slice(2))
  const timezone = resolveRefreshTimezone()
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

  let code = 0
  for (const a of selected) {
    const r = await processArea(workspaceRoot, runtimeRoot, a, force, timezone)
    if (r === 'fail') code = 1
  }
  process.exit(code)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
