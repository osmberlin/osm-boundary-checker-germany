import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import {
  GERMANY_OSM_SHARED_FGB_BASENAME,
  GERMANY_OSM_SHARED_PLZ_FGB_BASENAME,
} from '../shared/germanyOsmPbf.ts'
import { SOURCE_METADATA_FILE } from '../shared/sourceMetadata.ts'

type Owner = 'report-runtime' | 'source-cache-osm' | 'source-cache-official'

type OwnerRoot = {
  owner: Owner
  root: string
}

const ownerRoots: OwnerRoot[] = [
  { owner: 'report-runtime', root: path.resolve('.artifact-runtime-report') },
  { owner: 'source-cache-osm', root: path.resolve('.artifact-runtime/scopes/source-cache-osm') },
  {
    owner: 'source-cache-official',
    root: path.resolve('.artifact-runtime/scopes/source-cache-official'),
  },
]

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

function rel(root: string, filePath: string): string {
  return path.relative(root, filePath).split(path.sep).join('/')
}

function assertReportRuntimeContract(paths: string[]): void {
  const forbidden = paths.filter((entry) => {
    const lower = entry.toLowerCase()
    return (
      entry.includes('/source/') ||
      lower.endsWith('.pbf') ||
      lower.endsWith('.zip') ||
      lower.endsWith('.gpkg')
    )
  })
  if (forbidden.length > 0) {
    throw new Error(
      `[audit-artifact-ownership] report-runtime contains forbidden files:\n${forbidden
        .slice(0, 10)
        .map((entry) => `- ${entry}`)
        .join('\n')}`,
    )
  }
}

function assertOsmScopeContract(paths: string[]): void {
  const allowed = new Set([
    `.cache/osm/${GERMANY_OSM_SHARED_FGB_BASENAME}`,
    `.cache/osm/${GERMANY_OSM_SHARED_PLZ_FGB_BASENAME}`,
  ])
  const invalid = paths.filter((entry) => !allowed.has(entry))
  if (invalid.length > 0) {
    throw new Error(
      `[audit-artifact-ownership] source-cache-osm contains unexpected files:\n${invalid
        .slice(0, 10)
        .map((entry) => `- ${entry}`)
        .join('\n')}`,
    )
  }
}

function assertOfficialScopeContract(paths: string[]): void {
  const invalid = paths.filter((entry) => {
    if (!entry.startsWith('datasets/')) return true
    const parts = entry.split('/')
    if (parts.length !== 4) return true
    if (parts[2] !== 'source') return true
    return !(parts[3] === 'official.fgb' || parts[3] === SOURCE_METADATA_FILE)
  })
  if (invalid.length > 0) {
    throw new Error(
      `[audit-artifact-ownership] source-cache-official contains unexpected files:\n${invalid
        .slice(0, 10)
        .map((entry) => `- ${entry}`)
        .join('\n')}`,
    )
  }
}

const ownership = new Map<string, Owner[]>()
for (const ownerRoot of ownerRoots) {
  const files = walkFiles(ownerRoot.root).map((absolute) => rel(ownerRoot.root, absolute))
  if (ownerRoot.owner === 'report-runtime') assertReportRuntimeContract(files)
  if (ownerRoot.owner === 'source-cache-osm') assertOsmScopeContract(files)
  if (ownerRoot.owner === 'source-cache-official') assertOfficialScopeContract(files)
  for (const file of files) {
    const prior = ownership.get(file) ?? []
    prior.push(ownerRoot.owner)
    ownership.set(file, prior)
  }
}

const overlaps = [...ownership.entries()].filter(([, owners]) => owners.length > 1)
if (overlaps.length > 0) {
  throw new Error(
    `[audit-artifact-ownership] Duplicate ownership detected:\n${overlaps
      .slice(0, 20)
      .map(([filePath, owners]) => `- ${filePath}: ${owners.join(', ')}`)
      .join('\n')}`,
  )
}

console.log('[audit-artifact-ownership] Ownership audit passed with zero overlaps.')
