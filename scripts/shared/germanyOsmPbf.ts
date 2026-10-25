import { z } from 'zod'
import { datasetLicenseIdSchema } from './sourceMetadata.ts'

/** Local cache filename (stable path regardless of dated upstream basename). */
export const GERMANY_OSM_PBF_BASENAME = 'germany-latest.osm.pbf'
/** Public Geofabrik `latest` symlink — may lag; downloads resolve via {@link geofabrikGermanyExtract.ts}. */
export const GERMANY_OSM_PBF_URL = `https://download.geofabrik.de/europe/${GERMANY_OSM_PBF_BASENAME}`

/** Under workspace root; already covered by repo `.gitignore` (`.cache/`). */
export const GERMANY_OSM_CACHE_DIR = '.cache/osm'

/** Smaller PBF after `osmium tags-filter` (administrative boundary ways/relations). */
export const GERMANY_OSM_FILTERED_BASENAME = 'germany-boundaries-administrative.osm.pbf'

/**
 * Single shared FlatGeobuf for all compare runs: administrative boundaries with
 * non-empty `de:regionalschluessel`.
 */
export const GERMANY_OSM_SHARED_FGB_BASENAME = 'germany-admin-boundaries-rs.fgb'
/** Shared FlatGeobuf for postal code boundaries keyed by `postal_code`. */
export const GERMANY_OSM_SHARED_PLZ_FGB_BASENAME = 'germany-postal-code-boundaries.fgb'
/**
 * Candidate POINTS-only FGB for admin boundaries: every `boundary=administrative`
 * multipolygon with a configured `admin_level`, regardless of whether `de:*` keys are
 * set. Used purely for the additive `match_candidates` compare phase that surfaces
 * shape-only candidates next to `official_only` rows; the strong key-based pipeline
 * uses {@link GERMANY_OSM_SHARED_FGB_BASENAME} unchanged.
 */
export const GERMANY_OSM_ADMIN_CANDIDATES_FGB_BASENAME = 'germany-admin-candidates.fgb'
/** Candidate POINTS-only FGB for `boundary=postal_code` multipolygons (any `postal_code`). */
export const GERMANY_OSM_PLZ_CANDIDATES_FGB_BASENAME = 'germany-postal-code-candidates.fgb'
/** Intermediate PBF after `osmium tags-filter` for protected areas (separate from the admin one). */
export const GERMANY_OSM_PROTECTED_AREAS_FILTERED_BASENAME = 'germany-protected-areas.osm.pbf'
/**
 * Shared FlatGeobuf for all protected-area multipolygons (the key join uses those with a valid `ref:WDPA`;
 * the others are reachable by OSM id for the identity fallback). Feeds the `protected_area_wdpa` osmProfile.
 */
export const GERMANY_OSM_PROTECTED_AREAS_WDPA_FGB_BASENAME = 'germany-protected-areas-wdpa.fgb'
/**
 * Candidate POINTS-only FGB for all protected-area multipolygons (no `ref:WDPA` requirement).
 * Points are `ST_PointOnSurface` of the polygon.
 */
export const GERMANY_OSM_PROTECTED_AREAS_CANDIDATES_FGB_BASENAME =
  'germany-protected-areas-candidates.fgb'

/** Shared OSM FlatGeobufs staged in `source-cache-osm` fallback artifacts (no PBF). */
export const COMPARE_READY_OSM_FGB_BASENAMES = [
  GERMANY_OSM_SHARED_FGB_BASENAME,
  GERMANY_OSM_SHARED_PLZ_FGB_BASENAME,
  GERMANY_OSM_ADMIN_CANDIDATES_FGB_BASENAME,
  GERMANY_OSM_PLZ_CANDIDATES_FGB_BASENAME,
  GERMANY_OSM_PROTECTED_AREAS_WDPA_FGB_BASENAME,
  GERMANY_OSM_PROTECTED_AREAS_CANDIDATES_FGB_BASENAME,
] as const

export const DEFAULT_OSM_TAGS_FILTER_EXPRESSIONS = [
  'r/boundary=administrative',
  'w/boundary=administrative',
  'r/boundary=postal_code',
  'w/boundary=postal_code',
] as const

/** `osmium tags-filter` expressions for the protected-area extract (its own intermediate PBF). */
export const PROTECTED_AREAS_OSM_TAGS_FILTER_EXPRESSIONS = [
  'nwr/boundary=protected_area',
  'nwr/boundary=national_park',
  'nwr/leisure=nature_reserve',
  'nwr/protect_class',
  'nwr/protection_title',
] as const

export const germanyOsmSourceDefaultsSchema = z.object({
  provider: z.string().trim().min(1),
  dataset: z.string().trim().min(1),
  sourcePublicUrl: z.url(),
  sourceDownloadUrl: z.url(),
  licenseId: datasetLicenseIdSchema,
  licenseSourceUrl: z.url(),
})
export type GermanyOsmSourceDefaults = z.infer<typeof germanyOsmSourceDefaultsSchema>

/**
 * App-level OSM provenance defaults shared by all datasets (Geofabrik Germany extract).
 * Per-area `source/metadata.json` and `comparison_table.json` only persist runtime fields
 * under `osm` (`downloadedAt`, `extractedAt`, `sourceDateSource`); merge with `buildResolvedOsmSourceSide`
 * in [osmGermanyProvenance.ts](./osmGermanyProvenance.ts) / the report UI for full provenance.
 */
export const GERMANY_OSM_SOURCE_DEFAULTS: GermanyOsmSourceDefaults = {
  provider: 'OpenStreetMap (Geofabrik Germany extract)',
  dataset: GERMANY_OSM_PBF_BASENAME,
  sourcePublicUrl: 'https://download.geofabrik.de/europe/germany.html',
  sourceDownloadUrl: GERMANY_OSM_PBF_URL,
  licenseId: 'odbl_10',
  licenseSourceUrl: 'https://www.openstreetmap.org/copyright',
}
