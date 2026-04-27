import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import {
  GERMANY_OSM_SHARED_FGB_BASENAME,
  GERMANY_OSM_SHARED_PLZ_FGB_BASENAME,
} from '../shared/germanyOsmPbf.ts'
import { SOURCE_METADATA_FILE } from '../shared/sourceMetadata.ts'

/**
 * WHAT: Builds compare-ready fallback cache scopes under `.artifact-runtime/scopes`.
 * WHY: Refresh fallback should restore only the minimum required inputs per failed phase.
 */
const artifactRoot = path.resolve('.artifact-runtime')
rmSync(artifactRoot, { recursive: true, force: true })

const scopesRoot = path.join(artifactRoot, 'scopes')
const scopeSourceOsm = path.join(scopesRoot, 'source-cache-osm')
const scopeSourceOfficial = path.join(scopesRoot, 'source-cache-official')
mkdirSync(scopeSourceOsm, { recursive: true })
mkdirSync(scopeSourceOfficial, { recursive: true })

type ScopedUsage =
  | 'refresh_fallback_osm_inputs'
  | 'refresh_fallback_official_inputs'
  | 'refresh_fallback_compare_outputs'

type InventoryRow = {
  path: string
  bytes: number
}

type ScopeInventory = {
  usage: ScopedUsage
  root: string
  exists: boolean
  files: InventoryRow[]
  totalBytes: number
  fileCount: number
  largestFiles: InventoryRow[]
  forbiddenMatches: string[]
}

const FORBIDDEN_COMPARE_READY_PATTERNS = ['.pbf', '.zip', '.gpkg'] as const

function ensureParent(filePath: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true })
}

function copyFileIfExists(source: string, destination: string): boolean {
  if (!existsSync(source)) return false
  ensureParent(destination)
  cpSync(source, destination, { force: true })
  return true
}

function walkFiles(root: string): string[] {
  if (!existsSync(root)) return []
  const out: string[] = []
  const stack = [root]
  while (stack.length > 0) {
    const current = stack.pop()!
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name)
      if (entry.isDirectory()) {
        stack.push(absolute)
      } else if (entry.isFile()) {
        out.push(absolute)
      }
    }
  }
  out.sort((a, b) => a.localeCompare(b))
  return out
}

function buildScopeInventory(root: string, usage: ScopedUsage): ScopeInventory {
  const files = walkFiles(root).map((absolute) => {
    const rel = path.relative(root, absolute).split(path.sep).join('/')
    return {
      path: rel,
      bytes: statSync(absolute).size,
    }
  })
  const totalBytes = files.reduce((sum, f) => sum + f.bytes, 0)
  const largestFiles = [...files].sort((a, b) => b.bytes - a.bytes).slice(0, 10)
  const forbiddenMatches = files
    .map((f) => f.path)
    .filter((filePath) =>
      FORBIDDEN_COMPARE_READY_PATTERNS.some((pattern) => filePath.toLowerCase().endsWith(pattern)),
    )
  return {
    usage,
    root: path.relative(artifactRoot, root).split(path.sep).join('/'),
    exists: existsSync(root),
    files,
    totalBytes,
    fileCount: files.length,
    largestFiles,
    forbiddenMatches,
  }
}

function bytesToMiB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`
}

function buildSummaryMarkdown(scopes: Record<string, ScopeInventory>): string {
  const lines: string[] = []
  lines.push('## Cache scope inventory')
  lines.push('')
  for (const [name, info] of Object.entries(scopes)) {
    lines.push(`### ${name}`)
    lines.push(`- usage: \`${info.usage}\``)
    lines.push(`- root: \`${info.root}\``)
    lines.push(`- files: ${info.fileCount}`)
    lines.push(`- total: ${bytesToMiB(info.totalBytes)} (${info.totalBytes} bytes)`)
    if (info.forbiddenMatches.length > 0) {
      lines.push(`- forbidden_matches: ${info.forbiddenMatches.length}`)
    } else {
      lines.push('- forbidden_matches: 0')
    }
    lines.push('- largest_files:')
    if (info.largestFiles.length === 0) {
      lines.push('  - (none)')
    } else {
      for (const file of info.largestFiles.slice(0, 5)) {
        lines.push(`  - \`${file.path}\` (${bytesToMiB(file.bytes)})`)
      }
    }
    lines.push('')
  }
  return `${lines.join('\n')}\n`
}

const compareReadyOsmFiles = [
  GERMANY_OSM_SHARED_FGB_BASENAME,
  GERMANY_OSM_SHARED_PLZ_FGB_BASENAME,
] as const
const osmCacheDir = path.resolve('.cache/osm')
for (const fileName of compareReadyOsmFiles) {
  copyFileIfExists(
    path.join(osmCacheDir, fileName),
    path.join(scopeSourceOsm, '.cache', 'osm', fileName),
  )
}

const datasetsRoot = path.resolve('datasets')
const areasWithSource: string[] = []
if (existsSync(datasetsRoot)) {
  for (const entry of readdirSync(datasetsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue
    const area = entry.name
    const sourceDir = path.join(datasetsRoot, area, 'source')
    if (existsSync(sourceDir)) {
      const officialSourceFgb = path.join(sourceDir, 'official.fgb')
      const officialSourceMetadata = path.join(sourceDir, SOURCE_METADATA_FILE)
      const copiedOfficial = copyFileIfExists(
        officialSourceFgb,
        path.join(scopeSourceOfficial, 'datasets', area, 'source', 'official.fgb'),
      )
      const copiedMetadata = copyFileIfExists(
        officialSourceMetadata,
        path.join(scopeSourceOfficial, 'datasets', area, 'source', SOURCE_METADATA_FILE),
      )
      if (!copiedOfficial && existsSync(officialSourceFgb)) {
        // keep behavior explicit in index: if file exists but could not be copied we'd notice via inventory
      }
      if (!copiedMetadata && existsSync(officialSourceMetadata)) {
        // metadata is required by compare; missing entry will be visible in summary/inventory
      }
      areasWithSource.push(area)
    }
  }
}

const artifactIndexPath = path.join(artifactRoot, 'artifact-index.json')
const scopeInventories = {
  sourceCacheOsm: buildScopeInventory(scopeSourceOsm, 'refresh_fallback_osm_inputs'),
  sourceCacheOfficial: buildScopeInventory(scopeSourceOfficial, 'refresh_fallback_official_inputs'),
  compareOutputs: buildScopeInventory(
    path.join(scopesRoot, 'compare-outputs'),
    'refresh_fallback_compare_outputs',
  ),
}
writeFileSync(
  artifactIndexPath,
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      scopes: {
        sourceCacheOsm: scopeInventories.sourceCacheOsm,
        sourceCacheOfficial: {
          ...scopeInventories.sourceCacheOfficial,
          areas: areasWithSource.sort(),
        },
        compareOutputs: scopeInventories.compareOutputs,
      },
      bytes: {
        sourceCacheOsm: scopeInventories.sourceCacheOsm.totalBytes,
        sourceCacheOfficial: scopeInventories.sourceCacheOfficial.totalBytes,
        compareOutputs: scopeInventories.compareOutputs.totalBytes,
      },
      compareReadyCacheContract: {
        keep: [
          'datasets/*/source/official.fgb',
          'datasets/*/source/metadata.json',
          '.cache/osm/germany-admin-boundaries-rs.fgb',
          '.cache/osm/germany-postal-code-boundaries.fgb',
        ],
        drop: [
          '.cache/osm/*.pbf',
          '.cache/bkg/*.zip',
          '.cache/bkg/**/*.gpkg',
          'datasets/*/output/**',
        ],
        forbiddenPatterns: [...FORBIDDEN_COMPARE_READY_PATTERNS],
      },
    },
    null,
    2,
  )}\n`,
)

const summaryPath = path.join(artifactRoot, 'cache-scopes-summary.md')
writeFileSync(summaryPath, buildSummaryMarkdown(scopeInventories), { encoding: 'utf-8' })

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

const rustMetadataForStandaloneArtifact = path.resolve('rust-sidecar-metadata.json')
if (existsSync(rustMetadataForStandaloneArtifact)) {
  unlinkSync(rustMetadataForStandaloneArtifact)
}
cpSync(metadataPath, rustMetadataForStandaloneArtifact, { force: true })
