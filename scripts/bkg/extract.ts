#!/usr/bin/env bun
import { spawnSync } from 'node:child_process'
/**
 * Read BKG GeoPackage (default: `.cache/bkg/...` from `bun run bkg:download`) and write
 * `source/official.fgb` (WGS84 FlatGeobuf) per area using `bkg.config.json`.
 *
 * With no flags: extracts **all** areas from the config (same as `compare` defaulting to full runs in CI).
 * Use `--area <folder>` for a single area. Interactive Clack prompts appear when the GPKG is missing (non-CI).
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import * as p from '@clack/prompts'
import { BKG_CACHE_DIR, BKG_DOWNLOAD_METADATA, BKG_ZIP_URL } from '../shared/bkg.ts'
import { datasetFolderPath } from '../shared/datasetPaths.ts'
import {
  type AreaSourceMetadataFile,
  mergeAreaSourceMetadata,
  readAreaSourceMetadataFile,
  writeAreaSourceMetadataFile,
} from '../shared/sourceMetadata.ts'
import { workspaceRootFromHere } from '../shared/workspaceRoot.ts'

type ExtractConfig = {
  gpkgPath?: string | null
  areas: Record<string, string>
}

function isCi(): boolean {
  return process.env.CI === '1' || process.env.CI === 'true'
}

function parseArgs(argv: string[]) {
  let area: string | null = null
  let gpkg: string | null = null
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--area') {
      const v = argv[i + 1]
      if (v !== undefined) {
        area = v
        i++
      }
    }
    if (argv[i] === '--gpkg') {
      const v = argv[i + 1]
      if (v !== undefined) {
        gpkg = v
        i++
      }
    }
    if (argv[i] === '--all') {
      /* no-op: full extract is the default */
    }
  }
  return { area, gpkg }
}

function loadConfig(workspaceRoot: string): ExtractConfig {
  const path = join(workspaceRoot, 'bkg.config.json')
  if (!existsSync(path)) {
    throw new Error(`Missing ${path}`)
  }
  return JSON.parse(readFileSync(path, 'utf-8')) as ExtractConfig
}

function resolveGpkgPath(
  workspaceRoot: string,
  cfg: ExtractConfig,
  cliGpkg: string | null,
): string {
  if (cliGpkg) return resolve(process.cwd(), cliGpkg)
  if (cfg.gpkgPath) return resolve(workspaceRoot, cfg.gpkgPath)
  const metaPath = join(workspaceRoot, BKG_CACHE_DIR, BKG_DOWNLOAD_METADATA)
  if (!existsSync(metaPath)) {
    throw new Error(
      `No gpkgPath in config and missing ${metaPath}. Run bun run bkg:download first.`,
    )
  }
  const meta = JSON.parse(readFileSync(metaPath, 'utf-8')) as {
    gpkgRelativePath: string
  }
  return resolve(workspaceRoot, meta.gpkgRelativePath)
}

function downloadScript(workspaceRoot: string): string {
  return join(workspaceRoot, 'scripts/bkg/download.ts')
}

/** Resolve GPKG path; in non-CI, offer Clack when cache/config is missing or file absent. */
async function ensureGpkgPath(
  workspaceRoot: string,
  cfg: ExtractConfig,
  initialCliGpkg: string | null,
): Promise<string> {
  let cliGpkg = initialCliGpkg

  for (;;) {
    let candidate: string
    try {
      candidate = resolveGpkgPath(workspaceRoot, cfg, cliGpkg)
    } catch (err) {
      if (isCi()) {
        console.error(String(err))
        process.exit(1)
      }
      const action = await p.select({
        message: 'VG25 GeoPackage not found (cache / download-metadata missing). What next?',
        options: [
          {
            value: 'download',
            label: 'Download ZIP from BKG (runs bkg:download)',
          },
          {
            value: 'zip',
            label: 'Use a local ZIP (same as bkg:download --zip)',
          },
          { value: 'gpkg', label: 'Point to a local .gpkg file' },
          { value: 'cancel', label: 'Cancel' },
        ],
      })
      if (p.isCancel(action) || action === 'cancel') {
        p.cancel('Cancelled.')
        process.exit(0)
      }
      if (action === 'download') {
        const r = spawnSync('bun', [downloadScript(workspaceRoot)], {
          cwd: workspaceRoot,
          stdio: 'inherit',
        })
        if (r.status !== 0) {
          p.log.error('bkg:download failed.')
          continue
        }
        cliGpkg = null
        p.log.success('Download finished. Continuing extract…')
        continue
      }
      if (action === 'zip') {
        const zipPath = await p.text({
          message: 'Path to vg25.utm32s.gpkg.zip',
          placeholder: '/Users/you/Downloads/vg25.utm32s.gpkg.zip',
        })
        if (p.isCancel(zipPath)) {
          p.cancel('Cancelled.')
          process.exit(0)
        }
        const r = spawnSync('bun', [downloadScript(workspaceRoot), '--zip', zipPath], {
          cwd: workspaceRoot,
          stdio: 'inherit',
        })
        if (r.status !== 0) {
          p.log.error('bkg:download --zip failed.')
          continue
        }
        cliGpkg = null
        p.log.success('ZIP processed. Continuing extract…')
        continue
      }
      if (action === 'gpkg') {
        const g = await p.text({
          message: 'Path to DE_VG250.gpkg (or other VG25 .gpkg)',
          placeholder: '/path/to/DE_VG250.gpkg',
        })
        if (p.isCancel(g)) {
          p.cancel('Cancelled.')
          process.exit(0)
        }
        cliGpkg = g
        continue
      }
      continue
    }

    if (existsSync(candidate)) {
      return candidate
    }

    if (isCi()) {
      console.error(`GPKG not found: ${candidate}`)
      process.exit(1)
    }
    p.log.warn(`File not found: ${candidate}`)
    cliGpkg = null
    const retry = await p.confirm({
      message: 'Try again (pick another source)?',
      initialValue: true,
    })
    if (p.isCancel(retry) || !retry) {
      p.cancel('Cancelled.')
      process.exit(0)
    }
  }
}

function runOgr2ogr(gpkg: string, layer: string, outFgb: string): void {
  const r = spawnSync('ogr2ogr', ['-f', 'FlatGeobuf', '-t_srs', 'EPSG:4326', outFgb, gpkg, layer], {
    encoding: 'utf-8',
    stdio: ['ignore', 'inherit', 'pipe'],
  })
  if (r.status !== 0) {
    const detail = (r.stderr ?? '').trim() || '(no stderr)'
    throw new Error(
      `ogr2ogr failed (exit ${r.status}) for layer "${layer}". ${detail}\n` +
        `Hint: list layers with: ogrinfo -so "${gpkg}"`,
    )
  }
}

async function main() {
  const workspaceRoot = workspaceRootFromHere(import.meta.url)
  const { area, gpkg: cliGpkg } = parseArgs(process.argv.slice(2))
  const cfg = loadConfig(workspaceRoot)
  if (!isCi()) {
    p.intro('VG25 → FlatGeobuf')
  }
  const gpkgAbs = await ensureGpkgPath(workspaceRoot, cfg, cliGpkg)

  let downloadedAt: string | undefined
  const metaPath = join(workspaceRoot, BKG_CACHE_DIR, BKG_DOWNLOAD_METADATA)
  if (existsSync(metaPath)) {
    try {
      downloadedAt = (JSON.parse(readFileSync(metaPath, 'utf-8')) as { downloadedAt: string })
        .downloadedAt
    } catch {
      /* ignore */
    }
  }

  const entries = Object.entries(cfg.areas)
  const selected = area ? entries.filter(([name]) => name === area) : entries

  if (area && selected.length === 0) {
    console.error(`Unknown area "${area}" in bkg.config.json`)
    process.exit(1)
  }

  if (!isCi()) {
    p.log.info(`GeoPackage: ${gpkgAbs}`)
    p.log.info(
      `Extracting ${selected.length} area(s)${area ? ` (--area ${area})` : ' (full config)'}.`,
    )
  }

  for (const [areaFolder, layer] of selected) {
    const areaPath = datasetFolderPath(workspaceRoot, areaFolder)
    const outDir = join(areaPath, 'source')
    const outFgb = join(outDir, 'official.fgb')
    mkdirSync(outDir, { recursive: true })
    console.log(`${areaFolder}: ${layer} → ${outFgb}`)
    runOgr2ogr(gpkgAbs, layer, outFgb)

    const prev = readAreaSourceMetadataFile(areaPath) ?? {}
    const patch: AreaSourceMetadataFile = {
      official: {
        downloadedAt,
        provider: 'BKG',
        dataset: 'VG25',
        layer,
        sourceUrl: BKG_ZIP_URL,
      },
    }
    writeAreaSourceMetadataFile(areaPath, mergeAreaSourceMetadata(prev, patch))
  }

  if (!isCi()) {
    p.outro('Extract finished.')
  } else {
    console.log('Done.')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
