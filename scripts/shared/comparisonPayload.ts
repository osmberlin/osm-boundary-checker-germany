import { z } from 'zod'
import { attributeCheckConfigSchema } from './attributeChecks.ts'
import { matchedBySchema, matchRuleSchema } from './matchRules.ts'
import { ogcWfsInspectSourceSchema } from './ogcInspectSources.ts'
import { osmScopeFilterSchema } from './osmScopeFilter.ts'
import { rowFlagDefinitionSchema } from './rowFlags.ts'
import { sourceKindSchema } from './sourceKind.ts'
import {
  datasetLicenseIdSchema,
  osmLicenseCompatibilitySchema,
  osmSourceMetadataPersistedSchema,
  sourceMetadataSideSchema,
} from './sourceMetadata.ts'

export const reportMetricsSchema = z.object({
  iou: z.number(),
  areaDiffPct: z.number(),
  symmetricDiffPct: z.number(),
  hausdorffM: z.number(),
  hausdorffP95M: z.number().optional(),
  hausdorffNorm: z.number().optional(),
  issueIndicator: z
    .object({
      level: z.enum(['ok', 'review', 'issue']),
      reasons: z.array(
        z.enum([
          'STRONG_OVERLAP_LOW_DIFF',
          'BOUNDARY_OUTLIER_BUT_OVERLAP_STABLE',
          'LOW_IOU_HIGH_SYM_DIFF',
          'HIGH_AREA_DELTA',
          'BASELINE_ANOMALY_IOU_DELTA',
          'BASELINE_ANOMALY_SYMDIFF_DELTA',
          'BASELINE_ANOMALY_AREA_DELTA',
          'BASELINE_ANOMALY_HAUSDORFF_NORM_DELTA',
        ]),
      ),
    })
    .optional(),
  officialAreaM2: z.number(),
  osmAreaM2: z.number(),
})

export const bboxSchema = z.tuple([z.number(), z.number(), z.number(), z.number()])

export const staleOfficialKeySchema = z
  .object({
    toArs: z.string(),
    source: z.enum(['successor_table', 'ags_candidate', 'osm_map']),
    pairedUnmatchedKey: z.string().optional(),
  })
  .strict()

export const staleOfficialPredecessorSchema = z
  .object({
    fromArs: z.string(),
  })
  .strict()

/**
 * Licence of one official geometry (DtP: one licence and source per area), resolved at compare time
 * from `geometry_license_*` / `geometry_source_*` and the reviewed table in `data/license-compatibility/`.
 * Absent for datasets with one licence per dataset (`sourceMetadata.official`).
 */
export const officialLicenseSchema = z
  .object({
    licenseId: datasetLicenseIdSchema,
    licenseLabel: z.string().trim().min(1),
    licenseSourceUrl: z.string().optional(),
    osmCompatibility: osmLicenseCompatibilitySchema,
    osmCompatibilitySourceUrl: z.string().optional(),
    osmCompatibilityComment: z.string().optional(),
    sourceName: z.string().optional(),
    sourceUrl: z.string().optional(),
    /** Entry of the compatibility table that applied; absent when the licence is not in the table. */
    ruleId: z.string().optional(),
    /** `${sourceName}|${licenseLabel}`; matches `licenseBreakdown[].groupKey` and the `licenseGroup` URL param. */
    groupKey: z.string().min(1),
  })
  .strict()

/** One geometry source × licence of a dataset, with the number of rows it covers. */
export const licenseBreakdownEntrySchema = officialLicenseSchema
  .extend({
    rowCount: z.number().int().nonnegative(),
    /** Date of the compatibility decision (`decidedAt` of the applied table entry). */
    decidedAt: z.string().optional(),
  })
  .strict()

export const ATTRIBUTE_HINT_IDS = [
  'type_tags',
  'wikidata_missing',
  'wikidata_differs',
  'osm_ref_differs',
  'natura2000_missing',
  'wdpa_missing_in_dtp',
  'wdpa_missing_in_osm',
  'wdpa_differs',
] as const

/**
 * Suggestion for a matched row (protected areas): OSM tags that do not fit the DtP record.
 * Stored in the feature shard only.
 */
export const attributeHintSchema = z
  .object({
    id: z.enum(ATTRIBUTE_HINT_IDS),
    /** What the DtP record / category rule expects (`key=value`, or `type/id` for `osm_ref_differs`). */
    expected: z.array(z.string()),
    /** What OSM has today for the same keys (empty = tag missing). */
    actual: z.array(z.string()),
    /** Tags to add or change, key → value. */
    suggestedTags: z.record(z.string(), z.string()).optional(),
    /**
     * Who should change something: `osm` (a tag suggestion for the OSM object) or `reference`
     * (a note for the reference data, e.g. DtP, whose record lacks something OSM has).
     * Hints written before this field existed are about OSM.
     */
    target: z.enum(['osm', 'reference']).default('osm'),
  })
  .strict()

const reportRowBaseShape = {
  canonicalMatchKey: z.string(),
  nameLabel: z.string(),
  category: z.enum(['matched', 'official_only']),
  /**
   * Matched rows: the rule (position in `compare.matchRules`, kind) that paired the row with its
   * OSM object. The table keeps it only for rows not paired by the key join.
   */
  matchedBy: matchedBySchema.optional(),
  osmRelationId: z.string(),
  metrics: reportMetricsSchema.nullable(),
  mapBbox: bboxSchema.nullable(),
  officialForEditPath: z.string().nullable(),
  officialProperties: z.record(z.string(), z.unknown()).nullable(),
  osmProperties: z.record(z.string(), z.unknown()).nullable(),
  staleOfficialKey: staleOfficialKeySchema.optional(),
  /** Ids of the `rowFlags` that apply to this official row; absent when none. */
  flags: z.array(z.string()).optional(),
}

/** Full row as stored in the feature shard (`output/features/<key>.json`), incl. the resolved licence. */
export const reportRowSchema = z.object({
  ...reportRowBaseShape,
  officialLicense: officialLicenseSchema.optional(),
  /** Matched rows, shard only: WGS84 bbox of the official geometry (not in `comparison_table.json`). */
  officialBbox: bboxSchema.optional(),
  /** Matched rows, shard only: WGS84 bbox of the OSM geometry (not in `comparison_table.json`). */
  osmBbox: bboxSchema.optional(),
})

/** Row of `comparison_table.json`: no licence; the feature shard keeps the `officialLicense`. */
export const tableRowSchema = z.object(reportRowBaseShape)

export const unmatchedOsmRowSchema = z.object({
  canonicalMatchKey: z.string(),
  nameLabel: z.string(),
  osmRelationId: z.string(),
  adminLevel: z.string().nullable(),
  mapBbox: bboxSchema.nullable(),
  staleOfficialPredecessor: staleOfficialPredecessorSchema.optional(),
})

export const comparisonSourceMetadataEmbeddedSchema = z.object({
  official: sourceMetadataSideSchema,
  osm: osmSourceMetadataPersistedSchema.optional().default({}),
  /** Only for datasets with a licence per geometry; sorted by `rowCount` descending. */
  licenseBreakdown: z.array(licenseBreakdownEntrySchema).optional(),
})

/** Subset of direct `official.extractFilter` embedded for report provenance. */
export const officialExtractFilterSummarySchema = z
  .object({
    property: z
      .string()
      .trim()
      .regex(/^[A-Za-z_][A-Za-z0-9_]*$/),
    valuePrefix: z.string().trim().min(1),
  })
  .strict()

export const comparisonFilterConfigSummarySchema = z.object({
  officialMatchProperty: z.string().trim().min(1),
  bboxFilter: z.enum(['none', 'official_bbox_overlap']),
  bboxBufferDegrees: z.number().finite().nonnegative().optional(),
  osmScopeFilter: osmScopeFilterSchema,
  adminLevels: z.array(z.string().trim().min(1)).optional(),
  ignoreRelationIds: z.array(z.string().trim().min(1)).optional(),
  officialExtractLayer: z.string().trim().min(1).optional(),
  /** Direct-mode `official.extractFilter`: keep only features whose property value starts with this prefix. */
  officialExtractFilter: officialExtractFilterSummarySchema.optional(),
  /** Ordered OSM tags used as match keys (e.g. `de:regionalschluessel` for `admin_rs`). */
  osmMatchProperties: z.array(z.string().trim().min(1)).min(1).optional(),
  /**
   * From `compare.minZoom` in area config: Tippecanoe min zoom + map lock.
   * Defaults to 0 for comparison tables produced before this field was embedded.
   */
  minZoom: z.number().int().min(0).max(15).default(0),
})

export const idNormalizationPresetSchema = z.enum([
  'berlin-bezirk-rs5',
  'amtlicher-8',
  'regional-12',
  'plz-5',
  'text',
  'wdpa',
])

export const osmMatchCriteriaSummarySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('property') }).strict(),
  z
    .object({
      kind: z.literal('relation_id'),
      relationIds: z.array(z.string().trim().min(1)).min(1),
    })
    .strict(),
])

export const comparisonForReportSchema = z.object({
  area: z.string(),
  displayName: z.string().trim().min(1),
  titlePrefix: z.string().trim().min(1),
  generatedAt: z.string(),
  metricsCrs: z.string(),
  overpassBoundaryTag: z.enum(['administrative', 'postal_code', 'protected_area']).optional(),
  /** Wording of the official side in the report; absent means `official`. Only written for other kinds. */
  sourceKind: sourceKindSchema.optional(),
  hasPmtiles: z.boolean(),
  hasUnmatchedPmtiles: z.boolean().optional(),
  tippecanoeLayer: z.string(),
  sourceMetadata: comparisonSourceMetadataEmbeddedSchema,
  filterConfigSummary: comparisonFilterConfigSummarySchema,
  /** From `idNormalization.preset` in area config; embedded once per file. */
  idNormalizationPreset: idNormalizationPresetSchema.optional(),
  /** The ordered match rules of the dataset (`compare.matchRules`, or the one derived rule). */
  matchRules: z.array(matchRuleSchema).optional(),
  /** Written before `matchRules` existed (from `osm.matchCriteria`); the report still reads it. */
  osmMatchCriteria: osmMatchCriteriaSummarySchema.optional(),
  ogcInspectSources: z.array(ogcWfsInspectSourceSchema).optional(),
  /** From optional `rowFlags` in area config, with the number of flagged rows. */
  rowFlags: z.array(rowFlagDefinitionSchema).optional(),
  /** From optional `compare.attributeChecks` in area config; the report evaluates them per row. */
  attributeChecks: z.array(attributeCheckConfigSchema).optional(),
  rows: z.array(tableRowSchema),
  unmatchedOsm: z.array(unmatchedOsmRowSchema),
})

export const CANDIDATE_SIGNAL_IDS = [
  'dtp_id',
  'dtp_osm_ref',
  'wikidata',
  'natura2000',
  'inside',
  'name',
] as const

/**
 * Schema for an additive candidate OSM feature surfaced on the FeatureDetail page next to
 * `official_only` rows. Stored ONLY in `output/features/<key>.json` shards (never in the
 * main `comparison_table.json`) to keep the AreaReport payload lean. See
 * `scripts/compare/lib/matchCandidates.ts` for the producer.
 */
export const candidateMatchSchema = z
  .object({
    osmType: z.enum(['way', 'relation']),
    osmId: z.string().trim().min(1),
    name: z.string().nullable(),
    /** Admin profile only. */
    adminLevel: z.string().nullable().optional(),
    /** Admin profile only. */
    deRegionalRaw: z.string().nullable().optional(),
    /** Admin profile only. */
    deAgsRaw: z.string().nullable().optional(),
    /** Postal code profile only. */
    postalCodeRaw: z.string().nullable().optional(),
    /** Protected-area profile: signals that found this candidate, strongest first. */
    signals: z.array(z.enum(CANDIDATE_SIGNAL_IDS)).optional(),
    /** Protected-area profile: normalized name similarity 0..1. */
    nameSimilarity: z.number().min(0).max(1).optional(),
    /** Protected-area profile: current tags on the candidate (null = tag missing). */
    refWdpa: z.string().nullable().optional(),
    wikidata: z.string().nullable().optional(),
    protectionTitle: z.string().nullable().optional(),
    protectClass: z.string().nullable().optional(),
    /** Protected-area profile: tags to add to the OSM object, key → value. */
    suggestedTags: z.record(z.string(), z.string()).optional(),
    /** Protected-area profile: the candidate's OSM tags (flat key → value). */
    tags: z.record(z.string(), z.string()).optional(),
  })
  .strict()

export const featureDetailShardSchema = z.object({
  row: reportRowSchema,
  /**
   * Optional candidate matches for `official_only` rows. Empty array = phase ran and
   * found nothing; absent = phase was skipped (matched rows or candidate FGB missing).
   */
  candidates: z.array(candidateMatchSchema).optional(),
  /** Matched protected-area rows: tag suggestions; absent when there are none. */
  attributeHints: z.array(attributeHintSchema).optional(),
})

export type CandidateMatch = z.infer<typeof candidateMatchSchema>
export type CandidateSignalId = (typeof CANDIDATE_SIGNAL_IDS)[number]
export type AttributeHint = z.infer<typeof attributeHintSchema>

export const snapshotsSchema = z.object({
  area: z.string(),
  metricsCrs: z.string(),
  runs: z.array(
    z.object({
      id: z.string(),
      summary: z.object({
        totalRows: z.number(),
        meanIou: z.number(),
        matched: z.number(),
        unmatchedOsm: z.number(),
        issues: z.number().optional(),
        reviews: z.number().optional(),
        staleOfficialKey: z.number().optional(),
      }),
    }),
  ),
})

export type ReportMetrics = z.infer<typeof reportMetricsSchema>
export type OfficialLicense = z.infer<typeof officialLicenseSchema>
export type LicenseBreakdownEntry = z.infer<typeof licenseBreakdownEntrySchema>
export type ReportRow = z.infer<typeof reportRowSchema>
export type TableReportRow = z.infer<typeof tableRowSchema>
export type UnmatchedOsmReportRow = z.infer<typeof unmatchedOsmRowSchema>
export type ComparisonForReport = z.infer<typeof comparisonForReportSchema>
export type ComparisonFilterConfigSummary = z.infer<typeof comparisonFilterConfigSummarySchema>
export type IdNormalizationPreset = z.infer<typeof idNormalizationPresetSchema>
export type OsmMatchCriteriaSummary = z.infer<typeof osmMatchCriteriaSummarySchema>
export type FeatureDetailShard = z.infer<typeof featureDetailShardSchema>
export type SnapshotsJson = z.infer<typeof snapshotsSchema>
