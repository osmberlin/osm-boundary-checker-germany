import { existsSync } from 'node:fs'
import { join } from 'node:path'
import * as turf from '@turf/turf'
import type { BBox, Feature, MultiPolygon, Point, Polygon } from 'geojson'
import {
  GERMANY_OSM_ADMIN_CANDIDATES_FGB_BASENAME,
  GERMANY_OSM_CACHE_DIR,
  GERMANY_OSM_PLZ_CANDIDATES_FGB_BASENAME,
} from '../../shared/germanyOsmPbf.ts'
import type { OsmProfileId } from '../../shared/osmProfiles.ts'
import type { BoundaryConfig, IdNormalizationPreset } from './config.ts'
import { loadFeatureCollection } from './loadFeatureCollection.ts'
import { normalizeOsmValue } from './normalizeGermanKey.ts'

/**
 * Linear shrink factor used when no `compare.candidateShrinkFactor` is configured.
 * 0.7 ≈ 30 % linear shrink (≈49 % area shrink) — small enough to keep most central
 * candidates, large enough to suppress border noise from snapping/edge artefacts.
 */
export const DEFAULT_CANDIDATE_SHRINK_FACTOR = 0.7

/**
 * Compact descriptor of an OSM feature that *could* fill an `official_only` row.
 *
 * Only fields strictly required by the FeatureDetail UI are kept; geometry/bbox/lon/lat
 * intentionally omitted because v1 ships IDs only and lets Overpass-by-id fetch geometry
 * on demand. See `report/src/components/featureDetail/OfficialOnlyCandidatesSection.tsx`.
 */
export type CandidateMatch = {
  /** OSM object type derived from `osm_id` sign at extract time. */
  osmType: 'way' | 'relation'
  /** Numeric OSM id as string; combine with `osmType` for stable osm.org URLs. */
  osmId: string
  /** OSM `name` tag if present; null when the OSM object is unnamed. */
  name: string | null
  /** OSM `admin_level` tag (admin profile only). */
  adminLevel?: string | null
  /** Raw `de:regionalschluessel` value on the candidate (admin profile only). */
  deRegionalRaw?: string | null
  /** Raw `de:amtlicher_gemeindeschluessel` value on the candidate (admin profile only). */
  deAgsRaw?: string | null
  /** Raw `postal_code` value on the candidate (postal_code profile only). */
  postalCodeRaw?: string | null
}

/**
 * Subset of an `official_only` row consumed by the candidate matcher; deliberately
 * narrower than `CompareRow` so the matcher can be unit-tested without the rest of
 * the pipeline.
 */
export type OfficialOnlyInput = {
  canonicalMatchKey: string
  /** WGS84 polygon/multipolygon for the official feature; matcher skips other geometry types. */
  officialGeometryWgs84: Polygon | MultiPolygon | null
}

export type MatchCandidatesOptions = {
  /** Linear shrink factor in (0, 1]; defaults to {@link DEFAULT_CANDIDATE_SHRINK_FACTOR}. */
  shrinkFactor?: number
  /** OSM relation IDs (numeric strings) to drop before matching. */
  ignoreRelationIds?: ReadonlySet<string>
  /** Allowed OSM `admin_level` values (admin profile only). Empty / missing = no filter. */
  adminLevelAllowList?: ReadonlySet<string>
  /** Optional bbox prefilter applied to the candidate set in WGS84 [w, s, e, n]. */
  bboxFilter?: BBox
  /**
   * ID normalization preset used to derive each candidate's canonical match key, so we
   * can reject candidates whose key already matched in `officialKeySet`.
   */
  idNormalizationPreset: IdNormalizationPreset
  /** Profile decides which candidate FGB and which match property to consult. */
  osmProfileId: OsmProfileId
  /** Logical match property for this profile (e.g. `de:regionalschluessel`). */
  osmMatchProperty: string
}

const RELATION_ID_INT_PATTERN = /^-?\d+$/

function osmTypeAndIdFromOsmId(
  rawOsmId: unknown,
): { osmType: 'way' | 'relation'; osmId: string } | null {
  // Extracts encode `osm_id` as a signed integer string (negative ⇒ relation, positive ⇒ way).
  // Keep this aligned with `gdal-osm-boundaries.ini` + the SQL CASE in `extract-osm.ts`.
  const text =
    typeof rawOsmId === 'string'
      ? rawOsmId.trim()
      : typeof rawOsmId === 'number'
        ? String(rawOsmId)
        : ''
  if (text.length === 0 || !RELATION_ID_INT_PATTERN.test(text)) return null
  const numeric = Number(text)
  if (!Number.isFinite(numeric) || numeric === 0) return null
  if (numeric < 0) return { osmType: 'relation', osmId: String(Math.trunc(-numeric)) }
  return { osmType: 'way', osmId: String(Math.trunc(numeric)) }
}

function trimmedOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const t = value.trim()
  return t.length > 0 ? t : null
}

function bboxOfShrunkPolygon(geometry: Polygon | MultiPolygon): BBox {
  return turf.bbox({ type: 'Feature', geometry, properties: {} } as Feature) as BBox
}

function bboxesOverlap(a: BBox, b: BBox): boolean {
  return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3])
}

function asPolygonOrMultiPolygon(g: unknown): Polygon | MultiPolygon | null {
  if (!g || typeof g !== 'object') return null
  const t = (g as { type?: unknown }).type
  if (t === 'Polygon' || t === 'MultiPolygon') return g as Polygon | MultiPolygon
  return null
}

/**
 * Linearly shrink a polygon around its centroid. Falls back to the original geometry
 * if `transformScale` cannot produce a valid shape (e.g. degenerate input).
 */
export function shrinkOfficialPolygon(
  geometry: Polygon | MultiPolygon,
  shrinkFactor: number,
): Polygon | MultiPolygon {
  if (!(shrinkFactor > 0) || shrinkFactor > 1) return geometry
  if (shrinkFactor === 1) return geometry
  try {
    const feature: Feature<Polygon | MultiPolygon> = {
      type: 'Feature',
      geometry,
      properties: {},
    }
    // `transformScale` mutates by default; we pass `{ mutate: false }` so the matcher is
    // safe to call repeatedly on the same row without aliasing.
    const scaled = turf.transformScale(feature, shrinkFactor, {
      origin: 'centroid',
      mutate: false,
    }) as Feature<Polygon | MultiPolygon>
    const out = asPolygonOrMultiPolygon(scaled.geometry)
    return out ?? geometry
  } catch {
    return geometry
  }
}

/**
 * Determine the canonical match key a candidate would carry under this area's profile.
 * Returns the normalised key (possibly empty string) so callers can decide whether the
 * candidate is already accounted for in `officialKeySet` (and thus *not* a missing match).
 *
 * For `admin_ags` we apply the same AGS-first / AGS-from-RS fallback used in
 * `compare.ts → deriveOsmKeyForAgsMode`, otherwise the canonical key would be empty for
 * any feature that only carries `de:regionalschluessel` even though the strong-match
 * pipeline would have picked it up.
 */
function canonicalKeyForCandidate(
  props: Record<string, unknown>,
  profileId: OsmProfileId,
  matchProperty: string,
  preset: IdNormalizationPreset,
): string {
  if (profileId === 'admin_ags') {
    const agsRaw = trimmedOrNull(props['de:amtlicher_gemeindeschluessel'])
    if (agsRaw)
      return normalizeOsmValue('de:amtlicher_gemeindeschluessel', agsRaw, preset).canonicalMatchKey
    const rsRaw = trimmedOrNull(props['de:regionalschluessel'])
    if (rsRaw) {
      const digits = rsRaw.replace(/\D/g, '')
      if (digits.length >= 12) {
        const ags = `${digits.slice(0, 5)}${digits.slice(9, 12)}`
        return normalizeOsmValue('de:amtlicher_gemeindeschluessel', ags, preset).canonicalMatchKey
      }
    }
    return ''
  }
  const raw = trimmedOrNull(props[matchProperty])
  if (raw == null) return ''
  return normalizeOsmValue(matchProperty, raw, preset).canonicalMatchKey
}

/**
 * Index over candidate points, filterable by bbox query. Wraps `turf.geojsonRbush` so we
 * can keep the rest of the matcher decoupled from the underlying tree implementation.
 */
type CandidateIndex = ReturnType<typeof turf.geojsonRbush<Point, Record<string, unknown>>>

function buildCandidateIndex(features: Feature<Point>[]): CandidateIndex {
  const tree = turf.geojsonRbush<Point, Record<string, unknown>>()
  if (features.length === 0) return tree
  tree.load({
    type: 'FeatureCollection',
    features: features as Feature<Point, Record<string, unknown>>[],
  })
  return tree
}

function searchByBbox(tree: CandidateIndex, bbox: BBox): Feature<Point, Record<string, unknown>>[] {
  return tree.search(bbox).features
}

/**
 * Filter candidates to the eligible set for an area, evaluated lazily as features are
 * loaded so callers don't have to keep the full FGB in memory. Eligibility = passes the
 * area's `adminLevels` allowlist + `ignoreRelationIds` + bbox + has a usable osm_id.
 *
 * Candidates whose canonical key is already present in `officialKeySet` are *kept* here;
 * the per-row pass below filters them out. We need them in the index because they can
 * still be the candidate that resolves another `official_only` row when mis-keyed.
 *
 * Returned features keep their geometry (`Point`) and their original raw OSM properties
 * so the per-row pass can filter by `admin_level` / key without re-parsing.
 */
export function selectEligibleCandidates(
  rawFeatures: Iterable<Feature<Point>>,
  options: {
    adminLevelAllowList?: ReadonlySet<string>
    ignoreRelationIds?: ReadonlySet<string>
    bboxFilter?: BBox
  },
): Feature<Point>[] {
  const out: Feature<Point>[] = []
  for (const f of rawFeatures) {
    if (!f.geometry || f.geometry.type !== 'Point') continue
    const props = (f.properties ?? {}) as Record<string, unknown>
    const decoded = osmTypeAndIdFromOsmId(props.osm_id)
    if (!decoded) continue
    if (options.ignoreRelationIds && decoded.osmType === 'relation') {
      if (options.ignoreRelationIds.has(decoded.osmId)) continue
    }
    if (options.adminLevelAllowList && options.adminLevelAllowList.size > 0) {
      const lvl = trimmedOrNull(props.admin_level)
      if (lvl == null || !options.adminLevelAllowList.has(lvl)) continue
    }
    if (options.bboxFilter) {
      const c = f.geometry.coordinates
      const lng = c[0]
      const lat = c[1]
      if (typeof lng !== 'number' || typeof lat !== 'number') continue
      const [w, s, e, n] = options.bboxFilter
      if (lng < w || lng > e || lat < s || lat > n) continue
    }
    out.push(f)
  }
  return out
}

/**
 * Match shape-only OSM features against `official_only` rows. Returns one entry per row
 * even when the candidate list is empty so the report UI can show "Keine Kandidaten
 * gefunden" without ambiguity.
 *
 * For each row we:
 *   1. Skip rows without a polygonal official geometry (matched-only / unmatched_osm).
 *   2. Shrink the polygon by `shrinkFactor` (default 0.7) around its centroid.
 *   3. Bbox-query the candidate index over the shrunk bbox.
 *   4. For each hit, derive the candidate's canonical key and drop it if it already
 *      matched in `officialKeySet` (covers both no_key and unmatched_osm scope).
 *   5. Confirm the candidate point lies inside the shrunk polygon via point-in-polygon.
 */
export function matchCandidatesForOfficialOnly(input: {
  rows: ReadonlyArray<OfficialOnlyInput>
  officialKeySet: ReadonlySet<string>
  candidatePoints: ReadonlyArray<Feature<Point>>
  options: MatchCandidatesOptions
}): Map<string, CandidateMatch[]> {
  const { rows, officialKeySet, candidatePoints, options } = input
  const shrinkFactor = options.shrinkFactor ?? DEFAULT_CANDIDATE_SHRINK_FACTOR
  const tree = buildCandidateIndex([...candidatePoints])
  const result = new Map<string, CandidateMatch[]>()

  for (const row of rows) {
    const polygon = row.officialGeometryWgs84
    if (!polygon) {
      result.set(row.canonicalMatchKey, [])
      continue
    }
    const shrunk = shrinkOfficialPolygon(polygon, shrinkFactor)
    const shrunkBbox = bboxOfShrunkPolygon(shrunk)
    const hits = searchByBbox(tree, shrunkBbox)
    const matches: CandidateMatch[] = []
    const seen = new Set<string>()
    for (const hit of hits) {
      const props = (hit.properties ?? {}) as Record<string, unknown>
      const decoded = osmTypeAndIdFromOsmId(props.osm_id)
      if (!decoded) continue
      const dedupeKey = `${decoded.osmType}/${decoded.osmId}`
      if (seen.has(dedupeKey)) continue

      const canonical = canonicalKeyForCandidate(
        props,
        options.osmProfileId,
        options.osmMatchProperty,
        options.idNormalizationPreset,
      )
      if (canonical.length > 0 && officialKeySet.has(canonical)) continue

      const c = hit.geometry.coordinates
      if (typeof c[0] !== 'number' || typeof c[1] !== 'number') continue
      // Cheap reject before the heavier point-in-polygon test; the index is bbox-only so
      // this catches false positives near the bbox corners.
      const candidateBbox: BBox = [c[0], c[1], c[0], c[1]]
      if (!bboxesOverlap(candidateBbox, shrunkBbox)) continue
      if (!turf.booleanPointInPolygon(hit as Feature<Point>, shrunk)) continue

      const candidate: CandidateMatch = {
        osmType: decoded.osmType,
        osmId: decoded.osmId,
        name: trimmedOrNull(props.name),
      }
      if (options.osmProfileId === 'postal_code') {
        candidate.postalCodeRaw = trimmedOrNull(props.postal_code)
      } else {
        candidate.adminLevel = trimmedOrNull(props.admin_level)
        candidate.deRegionalRaw = trimmedOrNull(props['de:regionalschluessel'])
        candidate.deAgsRaw = trimmedOrNull(props['de:amtlicher_gemeindeschluessel'])
      }
      matches.push(candidate)
      seen.add(dedupeKey)
    }
    matches.sort((a, b) => {
      if (a.osmType !== b.osmType) return a.osmType === 'relation' ? -1 : 1
      const an = Number(a.osmId)
      const bn = Number(b.osmId)
      return an - bn
    })
    result.set(row.canonicalMatchKey, matches)
  }
  return result
}

/**
 * Resolve the candidate FGB path for a given area's `osmProfile`. Returns null for
 * profiles that do not currently ship a candidate FGB; callers should treat that as
 * "skip the match_candidates phase for this area".
 */
export function candidatesFgbPathForProfile(
  runtimeRoot: string,
  config: BoundaryConfig,
): string | null {
  const profileId = config.osm.profileId as OsmProfileId
  const basename =
    profileId === 'postal_code'
      ? GERMANY_OSM_PLZ_CANDIDATES_FGB_BASENAME
      : GERMANY_OSM_ADMIN_CANDIDATES_FGB_BASENAME
  return join(runtimeRoot, GERMANY_OSM_CACHE_DIR, basename)
}

/**
 * Best-effort load of candidate points from the configured FGB. Resolves to an empty
 * array if the file is absent so the compare run keeps going without failing.
 */
export async function loadCandidatePoints(
  runtimeRoot: string,
  config: BoundaryConfig,
): Promise<{ features: Feature<Point>[]; sourcePath: string | null }> {
  const path = candidatesFgbPathForProfile(runtimeRoot, config)
  if (!path) return { features: [], sourcePath: null }
  if (!existsSync(path)) return { features: [], sourcePath: path }
  const fc = await loadFeatureCollection(path)
  const features: Feature<Point>[] = []
  for (const f of fc.features) {
    if (!f.geometry || f.geometry.type !== 'Point') continue
    features.push(f as Feature<Point>)
  }
  return { features, sourcePath: path }
}
