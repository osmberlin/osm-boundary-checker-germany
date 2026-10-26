import { z } from 'zod'

/** Wikidata item of a protected area, compacted. Multi-valued properties are lists; empty ones are omitted. */
export const wikidataProtectedAreaItemSchema = z.object({
  /** German label. */
  label: z.string().optional(),
  /** P809 */
  wdpa: z.array(z.string()).optional(),
  /** P402, relation id only. */
  osmRelation: z.array(z.string()).optional(),
  /** P856 */
  website: z.array(z.string()).optional(),
  /** P137 */
  operator: z.array(z.object({ qid: z.string(), label: z.string().optional() })).optional(),
  /** P2046, hectares. */
  areaHa: z.number().optional(),
  /** P373 */
  commons: z.string().optional(),
})

export type WikidataProtectedAreaItem = z.infer<typeof wikidataProtectedAreaItemSchema>

/** `data/wikidata/protected-areas.json`: German P809 items plus the items DtP/OSM reference. */
export const wikidataProtectedAreasFileSchema = z.object({
  fetchedAt: z.string(),
  queryHash: z.string(),
  durationMs: z.number(),
  itemCount: z.number().int(),
  /** Items added by id because DtP or OSM reference them but the main query does not return them. */
  referencedCount: z.number().int(),
  splitByWdpaDigit: z.boolean().optional(),
  skipped: z.boolean().optional(),
  skipReason: z.string().optional(),
  sparqlError: z.string().optional(),
  byQid: z.record(z.string(), wikidataProtectedAreaItemSchema),
})

export type WikidataProtectedAreasFile = z.infer<typeof wikidataProtectedAreasFileSchema>

/** Item of the feature shard: the dump item plus its id; `notFound` when the id is not in the dump. */
export const wikidataShardItemSchema = wikidataProtectedAreaItemSchema.extend({
  qid: z.string(),
  notFound: z.boolean().optional(),
})

export type WikidataShardItem = z.infer<typeof wikidataShardItemSchema>

/**
 * Shard `wikidata`: the item the official `wikidata` property names and, when it differs, the one
 * the OSM `wikidata` tag names. `{}` = neither references an item.
 */
export const wikidataShardSchema = z.object({
  official: wikidataShardItemSchema.optional(),
  osm: wikidataShardItemSchema.optional(),
})

export type WikidataShard = z.infer<typeof wikidataShardSchema>
