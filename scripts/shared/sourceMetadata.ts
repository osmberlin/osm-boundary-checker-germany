import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const SOURCE_METADATA_FILE = 'metadata.json'

/** One side (BKG or OSM) in `source/metadata.json`. */
export type SourceMetadataSide = {
  downloadedAt?: string
  provider?: string
  dataset?: string
  layer?: string
  sourceUrl?: string
  note?: string
  /** Optional licence or terms line for attribution (set in source/metadata.json when known). */
  license?: string
}

/** On-disk shape for `<area>/source/metadata.json`. */
export type AreaSourceMetadataFile = {
  official?: SourceMetadataSide
  osm?: SourceMetadataSide
}

/** Embedded in `comparison_table.json` for the report UI. */
export type ComparisonSourceMetadata = {
  official: SourceMetadataSide | null
  osm: SourceMetadataSide | null
}

function readMetadataAt(path: string): AreaSourceMetadataFile | null {
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as AreaSourceMetadataFile
  } catch {
    return null
  }
}

export function readAreaSourceMetadataFile(areaPath: string): AreaSourceMetadataFile | null {
  const dir = join(areaPath, 'source')
  const primary = join(dir, SOURCE_METADATA_FILE)
  return readMetadataAt(primary)
}

function sideHasValues(s: SourceMetadataSide | undefined): boolean {
  if (!s) return false
  for (const v of Object.values(s)) {
    if (v == null) continue
    if (String(v).trim() !== '') return true
  }
  return false
}

export function toComparisonSourceMetadata(
  file: AreaSourceMetadataFile | null,
): ComparisonSourceMetadata | null {
  if (!file) return null
  const officialSide = file.official
  const osmSide = file.osm
  const official = officialSide !== undefined && sideHasValues(officialSide) ? officialSide : null
  const osm = osmSide !== undefined && sideHasValues(osmSide) ? osmSide : null
  if (!official && !osm) return null
  return { official, osm }
}

export function writeAreaSourceMetadataFile(areaPath: string, data: AreaSourceMetadataFile): void {
  const dir = join(areaPath, 'source')
  mkdirSync(dir, { recursive: true })
  const p = join(dir, SOURCE_METADATA_FILE)
  writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8')
}

export function mergeAreaSourceMetadata(
  base: AreaSourceMetadataFile,
  patch: AreaSourceMetadataFile,
): AreaSourceMetadataFile {
  const out: AreaSourceMetadataFile = { ...base }
  if (patch.official !== undefined) {
    out.official = { ...base.official, ...patch.official }
  }
  if (patch.osm !== undefined) {
    out.osm = { ...base.osm, ...patch.osm }
  }
  return out
}
