import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'

export const SOURCE_METADATA_FILE = 'metadata.json'

const optionalTrimmedString = z.preprocess((value) => {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}, z.string().min(1).optional())

export const sourceDateSourceSchema = z
  .enum([
    'wfs_capabilities',
    'bkg_download_metadata',
    'osm_pbf_header',
    'manual_override',
    'unknown',
  ])
  .optional()

/** One side (BKG or OSM) in `source/metadata.json`. */
export const sourceMetadataSideSchema = z.object({
  downloadedAt: optionalTrimmedString,
  sourcePublishedAt: optionalTrimmedString,
  sourceUpdatedAt: optionalTrimmedString,
  sourceDateSource: sourceDateSourceSchema,
  provider: optionalTrimmedString,
  dataset: optionalTrimmedString,
  layer: optionalTrimmedString,
  sourceUrl: optionalTrimmedString,
  note: optionalTrimmedString,
  /** Optional licence or terms line for attribution (set in source/metadata.json when known). */
  license: optionalTrimmedString,
})
export type SourceMetadataSide = z.infer<typeof sourceMetadataSideSchema>

/** On-disk shape for `<area>/source/metadata.json`. */
export const areaSourceMetadataFileSchema = z.object({
  official: sourceMetadataSideSchema.optional(),
  osm: sourceMetadataSideSchema.optional(),
})
export type AreaSourceMetadataFile = z.infer<typeof areaSourceMetadataFileSchema>

/** Embedded in `comparison_table.json` for the report UI. */
export const comparisonSourceMetadataSchema = z.object({
  official: sourceMetadataSideSchema.nullable(),
  osm: sourceMetadataSideSchema.nullable(),
})
export type ComparisonSourceMetadata = z.infer<typeof comparisonSourceMetadataSchema>

function readMetadataAt(path: string): AreaSourceMetadataFile | null {
  if (!existsSync(path)) return null
  try {
    return areaSourceMetadataFileSchema.parse(JSON.parse(readFileSync(path, 'utf-8')) as unknown)
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
  const normalized = areaSourceMetadataFileSchema.parse(data)
  writeFileSync(p, JSON.stringify(normalized, null, 2), 'utf-8')
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
