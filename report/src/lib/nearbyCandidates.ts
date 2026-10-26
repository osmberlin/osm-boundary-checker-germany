import type { CandidateMatch } from '../types/report'
import type { OverpassBoundaryHit } from './overpassBbox'
import { liveOsmObjectKey } from './overpassOsmObject'

/**
 * Objects of the nearby search that are not yet listed as candidates, in candidate form
 * (no signals; `tags` are the live tags from Overpass).
 */
export function nearbyCandidates(
  hits: readonly OverpassBoundaryHit[],
  candidates: readonly CandidateMatch[],
): CandidateMatch[] {
  const listed = new Set(candidates.map((c) => liveOsmObjectKey(c.osmType, c.osmId)))
  const out: CandidateMatch[] = []
  for (const hit of hits) {
    if (hit.type !== 'way' && hit.type !== 'relation') continue
    if (listed.has(liveOsmObjectKey(hit.type, hit.id))) continue
    out.push({
      osmType: hit.type,
      osmId: String(hit.id),
      name: hit.tags.name ?? null,
      adminLevel: hit.tags.admin_level ?? null,
      deRegionalRaw: hit.tags['de:regionalschluessel'] ?? null,
      postalCodeRaw: hit.tags.postal_code ?? null,
      tags: hit.tags,
    })
  }
  return out
}
