#!/usr/bin/env bun
import { spawnSync } from 'node:child_process'
/**
 * Download BKG VG25 utm32s GeoPackage (ZIP) into `.cache/bkg/`, unzip, record `downloadedAt`.
 * Requires `unzip` on PATH (macOS/Linux). Use `--zip /path/to/vg25.utm32s.gpkg.zip` to seed from a local file instead of HTTP.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import {
  BKG_CACHE_DIR,
  BKG_DOWNLOAD_METADATA,
  BKG_EXTRACT_SUBDIR,
  BKG_ZIP_NAME,
  BKG_ZIP_URL,
} from '../shared/bkg.ts'
import { runtimeRootFromWorkspace } from '../shared/runtimeRoot.ts'
import { workspaceRootFromHere } from '../shared/workspaceRoot.ts'

type DownloadMetadata = {
  downloadedAt: string
  sourceUrl: string
  zipRelativePath: string
  /** Path to `.gpkg` relative to workspace root. */
  gpkgRelativePath: string
}

function parseArgs(argv: string[]) {
  let zipPath: string | null = null
  let force = false
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--zip') {
      const v = argv[i + 1]
      if (v !== undefined) {
        zipPath = v
        i++
      }
    }
    if (argv[i] === '--force') force = true
  }
  return { zipPath, force }
}

function findGpkgFiles(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...findGpkgFiles(p))
    else if (e.isFile() && p.toLowerCase().endsWith('.gpkg')) out.push(p)
  }
  return out
}

function pickGpkg(paths: string[]): string {
  const preferred = paths.find((p) => /DE_VG250\.gpkg$/i.test(p))
  if (preferred) return preferred
  const fallback = paths[0]
  if (!fallback) {
    throw new Error('No .gpkg files found in extracted archive')
  }
  return fallback
}

async function main() {
  const workspaceRoot = workspaceRootFromHere(import.meta.url)
  const runtimeRoot = runtimeRootFromWorkspace(workspaceRoot)
  const { zipPath: localZip, force } = parseArgs(process.argv.slice(2))

  const cacheDir = join(runtimeRoot, BKG_CACHE_DIR)
  const zipDest = join(cacheDir, BKG_ZIP_NAME)
  const extractDir = join(cacheDir, BKG_EXTRACT_SUBDIR)

  mkdirSync(cacheDir, { recursive: true })

  if (existsSync(zipDest) && !force && !localZip) {
    console.log(`ZIP exists (use --force to re-download): ${zipDest}`)
  } else if (localZip) {
    const absZip = resolve(process.cwd(), localZip)
    if (!existsSync(absZip)) {
      console.error(`File not found: ${absZip}`)
      process.exit(1)
    }
    copyFileSync(absZip, zipDest)
    console.log(`Copied local ZIP to ${zipDest}`)
  } else {
    console.log(`Fetching ${BKG_ZIP_URL}`)
    const res = await fetch(BKG_ZIP_URL)
    if (!res.ok) {
      console.error(`HTTP ${res.status} ${res.statusText}`)
      process.exit(1)
    }
    const buf = Buffer.from(await res.arrayBuffer())
    writeFileSync(zipDest, buf)
    console.log(`Wrote ${zipDest} (${buf.length} bytes)`)
  }

  // Keep only the latest extracted dataset to avoid stale archive leftovers.
  rmSync(extractDir, { recursive: true, force: true })
  const unzip = spawnSync('unzip', ['-o', zipDest, '-d', extractDir], {
    stdio: 'inherit',
  })
  if (unzip.status !== 0) {
    console.error('`unzip` failed. Install unzip or extract the archive manually into', extractDir)
    process.exit(unzip.status ?? 1)
  }

  const gpkgPaths = findGpkgFiles(extractDir)
  if (gpkgPaths.length === 0) {
    console.error('No .gpkg found under', extractDir)
    process.exit(1)
  }
  const gpkgAbs = pickGpkg(gpkgPaths)
  const gpkgRelativePath = relative(workspaceRoot, gpkgAbs)

  const meta: DownloadMetadata = {
    downloadedAt: new Date().toISOString(),
    sourceUrl: BKG_ZIP_URL,
    zipRelativePath: relative(runtimeRoot, zipDest),
    gpkgRelativePath: relative(runtimeRoot, gpkgAbs),
  }
  writeFileSync(join(cacheDir, BKG_DOWNLOAD_METADATA), JSON.stringify(meta, null, 2), 'utf-8')

  console.log('download-metadata.json updated.')
  console.log('GPKG:', gpkgRelativePath)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
