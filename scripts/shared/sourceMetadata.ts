import { z } from 'zod'

export const SOURCE_METADATA_FILE = 'metadata.json'

const requiredTrimmedString = z.string().trim().min(1)
const requiredTrimmedUrl = z.string().trim().pipe(z.url())

const emptyStringToUndefined = z
  .string()
  .trim()
  .length(0)
  .transform(() => undefined)

const optionalTrimmedString = z.union([requiredTrimmedString, emptyStringToUndefined]).optional()

const optionalTrimmedUrl = z.union([requiredTrimmedUrl, emptyStringToUndefined]).optional()

const unknownDefaultString = optionalTrimmedString.transform((value) => value ?? 'unknown')

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
export type DatasetLicenseId = z.infer<typeof datasetLicenseIdSchema>

export const DATASET_LICENSE_LABELS: Record<DatasetLicenseId, string> = {
  unknown: 'unknown',
  odbl_10: 'ODbL-1.0',
  cc_by_30: 'CC-BY-3.0',
  cc_by_40: 'CC-BY-4.0',
  cc0_10: 'CC0-1.0',
  dl_de_by_20: 'DL-DE-BY-2.0',
  dl_de_zero_20: 'DL-DE-ZERO-2.0',
  custom: 'custom',
}

export function datasetLicenseLabelForId(id: DatasetLicenseId): string {
  return DATASET_LICENSE_LABELS[id]
}

export const osmLicenseCompatibilitySchema = z.enum(['unknown', 'no', 'yes_licence', 'yes_waiver'])

const sourceMetadataCommonSideSchema = z.object({
  downloadedAt: optionalTrimmedString,
  sourcePublishedAt: optionalTrimmedString,
  sourceUpdatedAt: optionalTrimmedString,
  sourceDateSource: sourceDateSourceSchema,
  provider: optionalTrimmedString,
  dataset: optionalTrimmedString,
  layer: optionalTrimmedString,
  /** Public dataset page where download/API links are documented. */
  sourcePublicUrl: requiredTrimmedUrl,
  /** Direct machine-readable download/API URL used by the pipeline. */
  sourceDownloadUrl: requiredTrimmedUrl,
  note: optionalTrimmedString,
  licenseId: datasetLicenseIdSchema.default('unknown'),
  licenseLabel: unknownDefaultString,
  licenseSourceUrl: optionalTrimmedUrl,
  /** Optional licence or terms line for attribution (set in source/metadata.json when known). */
  license: optionalTrimmedString,
})
/** One official-data side in `source/metadata.json` (includes OSM-compatibility assessment). */
export const sourceMetadataSideSchema = sourceMetadataCommonSideSchema.extend({
  osmCompatibility: osmLicenseCompatibilitySchema.default('unknown'),
  osmCompatibilitySourceUrl: optionalTrimmedUrl,
  osmCompatibilityComment: optionalTrimmedString,
})
export type SourceMetadataSide = z.infer<typeof sourceMetadataSideSchema>
/** One OSM side in `source/metadata.json` (no self-compatibility fields). */
export const osmSourceMetadataSideSchema = sourceMetadataCommonSideSchema
export type OsmSourceMetadataSide = z.infer<typeof osmSourceMetadataSideSchema>

/** On-disk shape for `<area>/source/metadata.json`. */
export const areaSourceMetadataFileSchema = z.object({
  official: sourceMetadataSideSchema.optional(),
  osm: osmSourceMetadataSideSchema.optional(),
})
export type AreaSourceMetadataFile = z.infer<typeof areaSourceMetadataFileSchema>

/** Embedded in `comparison_table.json` for the report UI. */
export const comparisonSourceMetadataSchema = z.object({
  official: sourceMetadataSideSchema,
  osm: osmSourceMetadataSideSchema,
})
export type ComparisonSourceMetadata = z.infer<typeof comparisonSourceMetadataSchema>

export function requireComparisonSourceMetadata(
  file: AreaSourceMetadataFile | null,
): ComparisonSourceMetadata {
  if (!file?.official || !file?.osm) {
    throw new Error('source/metadata.json must contain both `official` and `osm` sections')
  }
  return {
    official: file.official,
    osm: file.osm,
  }
}

export function toComparisonSourceMetadata(file: AreaSourceMetadataFile): ComparisonSourceMetadata {
  return requireComparisonSourceMetadata(file)
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
