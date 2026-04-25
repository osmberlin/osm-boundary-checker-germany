import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'

export const SOURCE_METADATA_FILE = 'metadata.json'

const optionalTrimmedString = z.preprocess((value) => {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}, z.string().min(1).optional())

const unknownDefaultString = z.preprocess((value) => {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}, z.string().min(1).default('unknown'))

export const sourceDateSourceSchema = z
  .enum([
    'wfs_capabilities',
    'bkg_download_metadata',
    'osm_pbf_header',
    'manual_override',
    'unknown',
  ])
  .optional()

export const datasetLicenseIdSchema = z.enum([
  'unknown',
  'odbl_10',
  'cc_by_30',
  'cc_by_40',
  'cc0_10',
  'dl_de_by_20',
  'dl_de_zero_20',
  'custom',
])

export const osmLicenseCompatibilitySchema = z.enum(['unknown', 'no', 'yes_licence', 'yes_waiver'])

/** One side (BKG or OSM) in `source/metadata.json`. */
export const sourceMetadataSideSchema = z.preprocess(
  (raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw
    const rec = raw as Record<string, unknown>
    const sourceDownloadUrl =
      typeof rec.sourceDownloadUrl === 'string' && rec.sourceDownloadUrl.trim() !== ''
        ? rec.sourceDownloadUrl
        : typeof rec.sourceUrl === 'string' && rec.sourceUrl.trim() !== ''
          ? rec.sourceUrl
          : undefined
    return {
      ...rec,
      ...(sourceDownloadUrl ? { sourceDownloadUrl } : {}),
    }
  },
  z.object({
    downloadedAt: optionalTrimmedString,
    sourcePublishedAt: optionalTrimmedString,
    sourceUpdatedAt: optionalTrimmedString,
    sourceDateSource: sourceDateSourceSchema,
    provider: optionalTrimmedString,
    dataset: optionalTrimmedString,
    layer: optionalTrimmedString,
    /** Public dataset page where download/API links are documented. */
    sourcePublicUrl: optionalTrimmedString,
    /** Direct machine-readable download/API URL used by the pipeline. */
    sourceDownloadUrl: optionalTrimmedString,
    note: optionalTrimmedString,
    licenseId: datasetLicenseIdSchema.default('unknown'),
    licenseLabel: unknownDefaultString,
    licenseSourceUrl: optionalTrimmedString,
    osmCompatibility: osmLicenseCompatibilitySchema.default('unknown'),
    osmCompatibilitySourceUrl: optionalTrimmedString,
    osmCompatibilityComment: optionalTrimmedString,
    /** Optional licence or terms line for attribution (set in source/metadata.json when known). */
    license: optionalTrimmedString,
  }),
)
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
