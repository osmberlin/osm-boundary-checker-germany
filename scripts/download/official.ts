#!/usr/bin/env bun
// Config-driven HTTP official boundaries (e.g. WFS GeoJSON) → official.path FlatGeobuf. Requires ogr2ogr.
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { areaHasCompareConfig, loadAreaConfig } from '../shared/areaConfig.ts'
import { DATASETS_DIRECTORY, datasetFolderPath } from '../shared/datasetPaths.ts'
import { parseDownloadOfficial } from '../shared/downloadOfficialConfig.ts'
import {
  mergeAreaSourceMetadata,
  readAreaSourceMetadataFile,
  writeAreaSourceMetadataFile,
} from '../shared/sourceMetadata.ts'
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

function runOgr2ogrGeojsonToFgb(geojsonPath: string, outFgb: string): void {
  const r = spawnSync('ogr2ogr', ['-f', 'FlatGeobuf', '-t_srs', 'EPSG:4326', outFgb, geojsonPath], {
    encoding: 'utf-8',
    stdio: ['ignore', 'inherit', 'pipe'],
  })
  if (r.status !== 0) {
    const detail = (r.stderr ?? '').trim() || '(no stderr)'
    throw new Error(`ogr2ogr failed (exit ${r.status}): ${detail}`)
  }
}

async function processArea(
  workspaceRoot: string,
  area: string,
  force: boolean,
): Promise<'ok' | 'skip' | 'fail'> {
  const areaPath = datasetFolderPath(workspaceRoot, area)
  let raw: unknown
  try {
    raw = loadAreaConfig(workspaceRoot, area)
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
  if (existsSync(outAbs) && !force) {
    logLine({ area, source: 'official', status: 'skip', reason: 'output_exists' })
    return 'skip'
  }

  const t0 = Date.now()
  logLine({ area, source: 'official', status: 'start', format: spec.format })

  const tmpName = `official-${area}-${randomBytes(8).toString('hex')}.geojson`
  const tmpPath = join(tmpdir(), tmpName)

  try {
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

    mkdirSync(join(outAbs, '..'), { recursive: true })
    runOgr2ogrGeojsonToFgb(tmpPath, outAbs)

    const downloadedAt = new Date().toISOString()
    const prev = readAreaSourceMetadataFile(areaPath) ?? {}
    const patch = {
      official: {
        downloadedAt,
        provider: 'HTTP',
        dataset: 'GeoJSON',
        sourceUrl: spec.url,
        ...(spec.crs ? { note: `Declared CRS: ${spec.crs}` } : {}),
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

  let code = 0
  for (const a of selected) {
    const r = await processArea(workspaceRoot, a, force)
    if (r === 'fail') code = 1
  }
  process.exit(code)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
