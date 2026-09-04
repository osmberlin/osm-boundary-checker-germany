import { z } from 'zod'

export const regionalHubOsmTagSchema = z.object({
  osmId: z.string(),
  population: z.string().optional(),
  populationDate: z.string().optional(),
  wikidata: z.string().optional(),
})

export type RegionalHubOsmTag = z.infer<typeof regionalHubOsmTagSchema>

export const regionalHubOsmTagsFileSchema = z.object({
  generatedAt: z.string(),
  featureCount: z.number().int(),
  byArs: z.record(z.string(), regionalHubOsmTagSchema),
})

export type RegionalHubOsmTagsFile = z.infer<typeof regionalHubOsmTagsFileSchema>

export const regionalHubWikidataRowSchema = z.object({
  qid: z.string(),
  ags8: z.string().optional(),
  pop: z.number().optional(),
  date: z.string().optional(),
  osmRelationId: z.string().optional(),
})

export type RegionalHubWikidataRow = z.infer<typeof regionalHubWikidataRowSchema>

export const regionalHubWikidataFileSchema = z.object({
  generatedAt: z.string(),
  queryHash: z.string(),
  durationMs: z.number(),
  rowCount: z.number().int(),
  duplicateArsCount: z.number().int(),
  skipped: z.boolean().optional(),
  skipReason: z.string().optional(),
  splitByLand: z.boolean().optional(),
  sparqlError: z.string().optional(),
  byArs: z.record(z.string(), regionalHubWikidataRowSchema),
})

export type RegionalHubWikidataFile = z.infer<typeof regionalHubWikidataFileSchema>

export const regionalHubMismatchFlagSchema = z.enum([
  'osm_wikidata',
  'osm_population',
  'wikidata_population',
  'wikidata_p402',
])

export type RegionalHubMismatchFlag = z.infer<typeof regionalHubMismatchFlagSchema>

export const regionalHubMismatchFlagsFileSchema = z.object({
  generatedAt: z.string(),
  byArs: z.record(z.string(), regionalHubMismatchFlagSchema),
})

export type RegionalHubMismatchFlagsFile = z.infer<typeof regionalHubMismatchFlagsFileSchema>

export const regionalHubManifestSchema = z.object({
  generatedAt: z.string(),
  destatis: z.object({
    snapshotDate: z.string().optional(),
    populationDate: z.string().optional(),
    sourcePublicUrl: z.string().optional(),
    downloadUrl: z.string().optional(),
    gemeindenWithPopulation: z.number().int().optional(),
    areaColumnHeader: z.string().optional(),
    populationColumnHeader: z.string().optional(),
    sampleArs: z.string().optional(),
    samplePopulation: z.number().optional(),
    sampleAreaKm2: z.number().optional(),
  }),
  osm: z.object({
    generatedAt: z.string().optional(),
    featureCount: z.number().int().optional(),
    skipReason: z.string().optional(),
  }),
  wikidata: z.object({
    generatedAt: z.string().optional(),
    durationMs: z.number().optional(),
    rowCount: z.number().int().optional(),
    duplicateArsCount: z.number().int().optional(),
    skipReason: z.string().optional(),
    splitByLand: z.boolean().optional(),
    sparqlError: z.string().optional(),
  }),
})

export type RegionalHubManifest = z.infer<typeof regionalHubManifestSchema>
