import { z } from 'zod'
import { officialProfileIdSchema, resolveOfficialProfile } from './officialProfiles.ts'
import { osmProfileIdSchema } from './osmProfiles.ts'
import { datasetLicenseIdSchema, osmLicenseCompatibilitySchema } from './sourceMetadata.ts'

const trimmedString = z.string().trim().min(1)
const nonEmptyStringArray = z.array(trimmedString).min(1)

const officialSourceSchema = z
  .object({
    provider: trimmedString.optional(),
    dataset: trimmedString.optional(),
    sourcePublicUrl: trimmedString.url().optional(),
    sourceDownloadUrl: trimmedString.url().optional(),
    note: trimmedString.optional(),
    licenseId: datasetLicenseIdSchema.optional(),
    licenseLabel: trimmedString.optional(),
    licenseSourceUrl: trimmedString.url().optional(),
    osmCompatibility: osmLicenseCompatibilitySchema.optional(),
    osmCompatibilitySourceUrl: trimmedString.url().optional(),
    osmCompatibilityComment: trimmedString.optional(),
    license: trimmedString.optional(),
  })
  .strict()

const officialDownloadSchema = z
  .object({
    kind: z.literal('http').default('http'),
    url: trimmedString,
    format: z.enum(['geojson', 'gml']).default('geojson'),
    crs: trimmedString.optional(),
  })
  .strict()

const compareSchema = z
  .object({
    officialMatchProperty: trimmedString,
    bboxFilter: z.enum(['none', 'official_bbox_overlap']),
    bboxBufferDegrees: z.number().finite().nonnegative().optional(),
    osmScopeFilter: z.enum(['none', 'centroid_in_official_coverage']),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.bboxFilter === 'official_bbox_overlap' && value.bboxBufferDegrees === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['bboxBufferDegrees'],
        message:
          'compare.bboxBufferDegrees is required when compare.bboxFilter=official_bbox_overlap',
      })
    }
    if (value.bboxFilter === 'none' && value.bboxBufferDegrees !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['bboxBufferDegrees'],
        message:
          'compare.bboxBufferDegrees is only valid when compare.bboxFilter=official_bbox_overlap',
      })
    }
  })

const idNormalizationSchema = z.object({
  preset: z.enum([
    'berlin-bezirk-ags',
    'amtlicher-8',
    'regional-12',
    'brandenburg-gemeinden-8',
    'plz-5',
    'text',
  ]),
})

const ogcInspectSourceSchema = z
  .object({
    id: trimmedString,
    label: trimmedString,
    type: z.literal('wfs'),
    baseUrl: trimmedString,
    typeName: trimmedString,
    wfsVersion: z.enum(['1.1.0', '2.0.0']).optional(),
    bboxAxisOrder: z.enum(['lonlat', 'latlon']).optional(),
    srsName: trimmedString.optional(),
    outputFormat: trimmedString.optional(),
    maxFeatures: z.number().finite().positive().optional(),
  })
  .strict()

const osmConfigSchema = z
  .object({
    extract: z
      .object({
        selectProperties: nonEmptyStringArray.optional(),
        includeRelationIds: nonEmptyStringArray.optional(),
        additionalWhereClauses: nonEmptyStringArray.optional(),
        tagsFilterExpressions: nonEmptyStringArray.optional(),
      })
      .strict()
      .optional(),
    matchCriteria: z
      .discriminatedUnion('kind', [
        z.object({ kind: z.literal('property') }).strict(),
        z.object({ kind: z.literal('relation_id'), relationIds: nonEmptyStringArray }).strict(),
      ])
      .optional(),
    adminLevels: nonEmptyStringArray.optional(),
    ignoreRelationIds: nonEmptyStringArray.optional(),
  })
  .strict()

const directAreaConfigSchema = z
  .object({
    officialMode: z.literal('direct'),
    displayName: trimmedString,
    titlePrefix: trimmedString,
    official: z
      .object({
        path: trimmedString,
        extractLayer: trimmedString.optional(),
        source: officialSourceSchema.optional(),
        download: officialDownloadSchema.optional(),
        constantMatchKey: trimmedString.optional(),
        keyTransposition: z.unknown().optional(),
      })
      .strict(),
    osmProfile: osmProfileIdSchema,
    osm: osmConfigSchema.optional(),
    idNormalization: idNormalizationSchema,
    metricsCrs: trimmedString,
    compare: compareSchema,
    ogcInspectSources: z.array(ogcInspectSourceSchema).optional(),
  })
  .strict()

const profileAreaConfigSchema = z
  .object({
    officialMode: z.literal('profile'),
    displayName: trimmedString,
    titlePrefix: trimmedString,
    officialProfile: officialProfileIdSchema,
    osmProfile: osmProfileIdSchema,
    osm: osmConfigSchema.optional(),
    idNormalization: idNormalizationSchema,
    metricsCrs: trimmedString,
    compare: compareSchema,
    ogcInspectSources: z.array(ogcInspectSourceSchema).optional(),
  })
  .strict()

const datasetConfigUnionSchema = z.discriminatedUnion('officialMode', [
  directAreaConfigSchema,
  profileAreaConfigSchema,
])

function issuePath(issue: z.core.$ZodIssue): string {
  if (issue.path.length === 0) return '(root)'
  return issue.path.map(String).join('.')
}

export type DirectAreaConfig = z.infer<typeof directAreaConfigSchema>
export type ProfileAreaConfig = z.infer<typeof profileAreaConfigSchema>
export type DatasetConfig = z.infer<typeof datasetConfigUnionSchema>

export function parseDatasetConfig(area: string, rawConfig: unknown): DatasetConfig {
  if (rawConfig == null || typeof rawConfig !== 'object' || Array.isArray(rawConfig)) {
    throw new Error(`${area}: config.(root): expected an object`)
  }
  const root = rawConfig as Record<string, unknown>
  const mode = root.officialProfile === undefined ? 'direct' : 'profile'
  const withMode = { ...root, officialMode: mode }
  const parsed = datasetConfigUnionSchema.safeParse(withMode)
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `config.${issuePath(issue)}: ${issue.message}`)
      .join('; ')
    throw new Error(`${area}: ${details}`)
  }
  return parsed.data
}

export function officialSourceFromDatasetConfig(config: DatasetConfig) {
  if (config.officialMode === 'profile') {
    const profile = resolveOfficialProfile(config.officialProfile)
    return {
      provider: profile.provider,
      dataset: profile.dataset,
      sourcePublicUrl: profile.sourcePublicUrl,
      sourceDownloadUrl: profile.sourceDownloadUrl,
      licenseId: profile.licenseId,
      licenseSourceUrl: profile.licenseSourceUrl,
      osmCompatibility: profile.osmCompatibility,
      osmCompatibilitySourceUrl: profile.osmCompatibilitySourceUrl,
      osmCompatibilityComment: profile.osmCompatibilityComment,
    } as const
  }
  return config.official.source ?? null
}
