import { z } from 'zod'

/** Six GV100AD lookup maps keyed by official codes (digits-only strings). */
export const germanKeyLookupMapsSchema = z.object({
  bundeslaender: z.record(z.string(), z.string()),
  regierungsbezirke: z.record(z.string(), z.string()),
  kreise: z.record(z.string(), z.string()),
  gemeindeverbaende: z.record(z.string(), z.string()),
  gemeindenByAgs: z.record(z.string(), z.string()),
  gemeindenByArs: z.record(z.string(), z.string()),
})

export type GermanKeyLookupMaps = z.infer<typeof germanKeyLookupMapsSchema>

export const germanKeyPublicationSourceSchema = z.object({
  downloadUrl: z.string(),
  archiveEntry: z.string(),
  snapshotDate: z.string(),
})

export type GermanKeyPublicationSource = z.infer<typeof germanKeyPublicationSourceSchema>

/** Current-quarter (“latest”) Destatis extract — full maps + provenance. */
export const germanKeyLatestDatasetSchema = germanKeyLookupMapsSchema.extend({
  id: z.literal('latest'),
  label: z.string(),
  provenanceLines: z.array(z.string()),
  sourcePublicUrl: z.string(),
  source: germanKeyPublicationSourceSchema,
})

export type GermanKeyLatestDataset = z.infer<typeof germanKeyLatestDatasetSchema>

/** Keys present in annual GV100ADJ but absent from `latest`, with last official listing year. */
export const germanKeyObsoleteSectionSchema = z.object({
  maps: germanKeyLookupMapsSchema,
  lastContainedInYear: z.object({
    bundeslaender: z.record(z.string(), z.number().int()),
    regierungsbezirke: z.record(z.string(), z.number().int()),
    kreise: z.record(z.string(), z.number().int()),
    gemeindeverbaende: z.record(z.string(), z.number().int()),
    gemeindenByAgs: z.record(z.string(), z.number().int()),
    gemeindenByArs: z.record(z.string(), z.number().int()),
  }),
})

export type GermanKeyObsoleteSection = z.infer<typeof germanKeyObsoleteSectionSchema>

/** Keys are `"2018"` … `"2024"` (GV100ADJ Jahresausgabe 31.12.YYYY). */
export const germanKeyLookupBundleSchema = z.object({
  checkedAt: z.string(),
  generatedAt: z.string(),
  latest: germanKeyLatestDatasetSchema,
  annualSourcePublicUrlsByYear: z.record(z.string(), z.string()),
  obsolete: germanKeyObsoleteSectionSchema,
})

export type GermanKeyLookupBundle = z.infer<typeof germanKeyLookupBundleSchema>
