import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'

/**
 * WHAT: Rebuilds `.artifact-runtime` and copies runtime payload folders (`datasets` and optional `data`) into it.
 * WHY: Creates a stable artifact layout that downstream Pages deploy steps can consume regardless of workspace structure.
 */
const artifactRoot = path.resolve('.artifact-runtime')
rmSync(artifactRoot, { recursive: true, force: true })

const artifactDatasets = path.join(artifactRoot, 'datasets')
const artifactData = path.join(artifactRoot, 'data')
mkdirSync(artifactDatasets, { recursive: true })
mkdirSync(artifactData, { recursive: true })

cpSync(path.resolve('datasets'), artifactDatasets, { recursive: true, force: true })

const dataRoot = path.resolve('data')
if (existsSync(dataRoot)) {
  cpSync(dataRoot, artifactData, { recursive: true, force: true })
}

const scopesRoot = path.join(artifactRoot, 'scopes')
const scopeSourceOsm = path.join(scopesRoot, 'source-cache-osm')
const scopeSourceBkg = path.join(scopesRoot, 'source-cache-bkg')
const scopeSourceOfficial = path.join(scopesRoot, 'source-cache-official')
const scopeCompareOutputs = path.join(scopesRoot, 'compare-outputs')
mkdirSync(scopeSourceOsm, { recursive: true })
mkdirSync(scopeSourceBkg, { recursive: true })
mkdirSync(scopeSourceOfficial, { recursive: true })
mkdirSync(scopeCompareOutputs, { recursive: true })

const osmCacheDir = path.resolve('.cache/osm')
if (existsSync(osmCacheDir)) {
  cpSync(osmCacheDir, path.join(scopeSourceOsm, '.cache', 'osm'), { recursive: true, force: true })
}
const bkgCacheDir = path.resolve('.cache/bkg')
if (existsSync(bkgCacheDir)) {
  cpSync(bkgCacheDir, path.join(scopeSourceBkg, '.cache', 'bkg'), { recursive: true, force: true })
}

const datasetsRoot = path.resolve('datasets')
const areasWithSource: string[] = []
const areasWithCompareOutput: string[] = []
if (existsSync(datasetsRoot)) {
  for (const entry of readdirSync(datasetsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue
    const area = entry.name
    const sourceDir = path.join(datasetsRoot, area, 'source')
    const outputDir = path.join(datasetsRoot, area, 'output')
    const snapshotsJson = path.join(datasetsRoot, area, 'snapshots.json')
    if (existsSync(sourceDir)) {
      cpSync(sourceDir, path.join(scopeSourceOfficial, 'datasets', area, 'source'), {
        recursive: true,
        force: true,
      })
      areasWithSource.push(area)
    }
    if (existsSync(outputDir)) {
      cpSync(outputDir, path.join(scopeCompareOutputs, 'datasets', area, 'output'), {
        recursive: true,
        force: true,
      })
      areasWithCompareOutput.push(area)
    }
    if (existsSync(snapshotsJson)) {
      mkdirSync(path.join(scopeCompareOutputs, 'datasets', area), { recursive: true })
      cpSync(snapshotsJson, path.join(scopeCompareOutputs, 'datasets', area, 'snapshots.json'), {
        force: true,
      })
      if (!areasWithCompareOutput.includes(area)) areasWithCompareOutput.push(area)
    }
  }
}

const artifactIndexPath = path.join(artifactRoot, 'artifact-index.json')
writeFileSync(
  artifactIndexPath,
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      scopes: {
        sourceCacheOsm: {
          path: 'scopes/source-cache-osm',
          exists: existsSync(path.join(scopeSourceOsm, '.cache', 'osm')),
        },
        sourceCacheBkg: {
          path: 'scopes/source-cache-bkg',
          exists: existsSync(path.join(scopeSourceBkg, '.cache', 'bkg')),
        },
        sourceCacheOfficial: {
          path: 'scopes/source-cache-official',
          areas: areasWithSource.sort(),
        },
        compareOutputs: {
          path: 'scopes/compare-outputs',
          areas: areasWithCompareOutput.sort(),
        },
      },
      bytes: {
        datasets: existsSync(artifactDatasets) ? statSync(artifactDatasets).size : 0,
      },
    },
    null,
    2,
  )}\n`,
)

const rustSidecarMetadata = {
  fingerprint: process.env.RUST_SIDECAR_FINGERPRINT ?? null,
  inputHash: process.env.RUST_SIDECAR_INPUT_HASH ?? null,
  rustcRelease: process.env.RUSTC_RELEASE ?? null,
  rustcVersion: process.env.RUSTC_VERSION ?? null,
  changeStatus: process.env.RUST_SIDECAR_CHANGE_STATUS ?? 'unknown',
  previousFingerprint: process.env.RUST_SIDECAR_PREVIOUS_FINGERPRINT || null,
  cacheHit:
    process.env.RUST_SIDECAR_CACHE_HIT === 'true'
      ? true
      : process.env.RUST_SIDECAR_CACHE_HIT === 'false'
        ? false
        : null,
}

const metadataPath = path.join(artifactRoot, 'rust-sidecar-metadata.json')
writeFileSync(
  metadataPath,
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      rustSidecar: rustSidecarMetadata,
    },
    null,
    2,
  )}\n`,
  { encoding: 'utf-8' },
)
