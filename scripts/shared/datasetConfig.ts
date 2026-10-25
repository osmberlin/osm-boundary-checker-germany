import { z } from 'zod'
import { officialHttpDownloadSchema } from './downloadOfficialConfig.ts'
import { DTP_OFFICIAL_PROFILE_ID, DTP_OFFICIAL_SOURCE, dtpSelectionSchema } from './dtpOfficial.ts'
import { matchRuleSchema, validateMatchRules } from './matchRules.ts'
import { officialProfileIdSchema, resolveOfficialProfile } from './officialProfiles.ts'
import { osmProfileIdSchema } from './osmProfiles.ts'
import { osmScopeFilterSchema } from './osmScopeFilter.ts'
import { rowFlagsConfigSchema } from './rowFlags.ts'
import type { SourceKind } from './sourceKind.ts'
import { datasetLicenseIdSchema, osmLicenseCompatibilitySchema } from './sourceMetadata.ts'

const trimmedString = z.string().trim().min(1)
const nonEmptyStringArray = z.array(trimmedString).min(1)
const extractFilterSchema = z
  .object({
    property: z
      .string()
      .trim()
      .regex(/^[A-Za-z_][A-Za-z0-9_]*$/),
    valuePrefix: z.string().trim().min(1),
  })
  .strict()

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

const officialDownloadSchema = officialHttpDownloadSchema

const compareSchema = z
  .object({
    /**
     * Official property the rows are keyed by (and the `key` rule's official side). Required unless
     * `matchRules` has a `key` rule, which then supplies it.
     */
    officialMatchProperty: trimmedString.optional(),
    /**
     * Ordered ways to find the OSM object of an official row (see `matchRules.ts`). Each rule only
     * handles rows the earlier rules left unmatched; an OSM object is used for one row at most.
     * Without it the config's one rule is derived from `officialMatchProperty`, the OSM profile and
     * `osm.matchCriteria`.
     */
    matchRules: z.array(matchRuleSchema).min(1).optional(),
    bboxFilter: z.enum(['none', 'official_bbox_overlap']),
    bboxBufferDegrees: z.number().finite().nonnegative().optional(),
    osmScopeFilter: osmScopeFilterSchema,
    /**
     * Linear shrink factor (0..1] applied to each `official_only` polygon before testing
     * whether a candidate point falls inside. Defaults to `0.7` (≈30 % linear shrink) so
     * that candidates near the polygon edge are not picked up as noise. The match is
     * informational and does not influence the strong key-based join.
     */
    candidateShrinkFactor: z.number().finite().positive().max(1).optional(),
    /**
     * Lowest zoom for PMTiles generation (Tippecanoe `--minimum-zoom` when > 0) and map
     * `minZoom` lock; must match current `--maximum-zoom` cap (15). Use `0` when tiles
     * should be available from world view.
     */
    minZoom: z.number().int().min(0).max(15),
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
  preset: z.enum(['berlin-bezirk-rs5', 'amtlicher-8', 'regional-12', 'plz-5', 'text', 'wdpa']),
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
    /**
     * DtP datasets only (default on): `unmatchedOsm` keeps only OSM objects whose tags fit the type
     * scope of one of the dataset's DtP categories (`scripts/shared/protectedAreaCategories.ts`).
     * Key matches are never dropped. Set `false` to list every `ref:WDPA` object.
     */
    protectedAreaTypeScope: z.boolean().optional(),
  })
  .strict()

const directAreaConfigSchema = z
  .object({
    officialMode: z.literal('direct'),
    displayName: trimmedString,
    titlePrefix: trimmedString,
    official: z
      .object({
        extractLayer: trimmedString.optional(),
        extractFilter: extractFilterSchema.optional(),
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
    /** Badges for rows of the official data that match a property value (see `rowFlags.ts`). */
    rowFlags: rowFlagsConfigSchema.optional(),
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
    /** Badges for rows of the official data that match a property value (see `rowFlags.ts`). */
    rowFlags: rowFlagsConfigSchema.optional(),
  })
  .strict()

/** DtP protected areas: `officialProfile: "dtp_protected_areas"` + `official.dtp` (category selection). */
const dtpAreaConfigSchema = z
  .object({
    officialMode: z.literal('dtp'),
    displayName: trimmedString,
    titlePrefix: trimmedString,
    officialProfile: z.literal(DTP_OFFICIAL_PROFILE_ID),
    official: z.object({ dtp: dtpSelectionSchema }).strict(),
    osmProfile: osmProfileIdSchema,
    osm: osmConfigSchema.optional(),
    idNormalization: idNormalizationSchema,
    metricsCrs: trimmedString,
    compare: compareSchema,
    ogcInspectSources: z.array(ogcInspectSourceSchema).optional(),
    /** Badges for rows of the official data that match a property value (see `rowFlags.ts`). */
    rowFlags: rowFlagsConfigSchema.optional(),
  })
  .strict()

const datasetConfigUnionSchema = z.discriminatedUnion('officialMode', [
  directAreaConfigSchema,
  profileAreaConfigSchema,
  dtpAreaConfigSchema,
])

function issuePath(issue: z.core.$ZodIssue): string {
  if (issue.path.length === 0) return '(root)'
  return issue.path.map(String).join('.')
}

export type DirectAreaConfig = z.infer<typeof directAreaConfigSchema>
export type ProfileAreaConfig = z.infer<typeof profileAreaConfigSchema>
export type DtpAreaConfig = z.infer<typeof dtpAreaConfigSchema>
export type DatasetConfig = z.infer<typeof datasetConfigUnionSchema>

export function parseDatasetConfig(area: string, rawConfig: unknown): DatasetConfig {
  if (rawConfig == null || typeof rawConfig !== 'object' || Array.isArray(rawConfig)) {
    throw new Error(`${area}: config.(root): expected an object`)
  }
  const root = rawConfig as Record<string, unknown>
  const mode =
    root.officialProfile === undefined
      ? 'direct'
      : root.officialProfile === DTP_OFFICIAL_PROFILE_ID
        ? 'dtp'
        : 'profile'
  const withMode = { ...root, officialMode: mode }
  const parsed = datasetConfigUnionSchema.safeParse(withMode)
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `config.${issuePath(issue)}: ${issue.message}`)
      .join('; ')
    throw new Error(`${area}: ${details}`)
  }
  const ruleIssues = validateMatchRules(parsed.data)
  if (ruleIssues.length > 0) throw new Error(`${area}: ${ruleIssues.join('; ')}`)
  return parsed.data
}

/** Report wording of the official side: DtP datasets say "DtP", everything else "amtlich". */
export function sourceKindFromDatasetConfig(
  config: Pick<DatasetConfig, 'officialMode'>,
): SourceKind {
  return config.officialMode === 'dtp' ? 'dtp' : 'official'
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
  if (config.officialMode === 'dtp') {
    return {
      provider: DTP_OFFICIAL_SOURCE.provider,
      dataset: DTP_OFFICIAL_SOURCE.dataset,
      sourcePublicUrl: DTP_OFFICIAL_SOURCE.sourcePublicUrl,
      sourceDownloadUrl: DTP_OFFICIAL_SOURCE.sourceDownloadUrl,
      licenseId: DTP_OFFICIAL_SOURCE.licenseId,
      licenseSourceUrl: DTP_OFFICIAL_SOURCE.licenseSourceUrl,
      osmCompatibility: DTP_OFFICIAL_SOURCE.osmCompatibility,
      osmCompatibilityComment: DTP_OFFICIAL_SOURCE.osmCompatibilityComment,
    } as const
  }
  return config.official.source ?? null
}
