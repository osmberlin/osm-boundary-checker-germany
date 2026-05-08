import { z } from 'zod'

/**
 * Overpass QL: tags for a single relation by id (no geometry).
 * Tiny payload — used for live tag inspection of the matched OSM relation.
 */
export function buildOverpassRelationTagsQuery(relationId: number): string {
  return `[out:json][timeout:25];
relation(${relationId});
out tags;`
}

const OverpassRelationTagsResponseSchema = z.looseObject({
  osm3s: z
    .looseObject({
      timestamp_osm_base: z.string().optional(),
    })
    .optional(),
  elements: z
    .array(
      z.looseObject({
        type: z.string().optional(),
        id: z.coerce.number().optional(),
        tags: z.record(z.string(), z.string()).optional(),
      }),
    )
    .optional(),
})

export type ParsedOverpassRelationTags = {
  /** `null` when the relation does not exist or returned no tags. */
  tags: Record<string, string> | null
  /** Overpass replication timestamp from `osm3s.timestamp_osm_base`; `null` when absent. */
  replicationDate: string | null
}

export function parseOverpassRelationTagsResponse(
  jsonText: string,
  relationId: number,
): ParsedOverpassRelationTags {
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    throw new Error('INVALID_OVERPASS_JSON')
  }
  const validated = OverpassRelationTagsResponseSchema.safeParse(parsed)
  if (!validated.success) throw new Error('INVALID_OVERPASS_JSON')
  const replicationDate = validated.data.osm3s?.timestamp_osm_base?.trim() || null
  const match = (validated.data.elements ?? []).find(
    (el) => el.type === 'relation' && el.id === relationId,
  )
  const tags = match?.tags && Object.keys(match.tags).length > 0 ? match.tags : null
  return { tags, replicationDate }
}
