import { z } from 'zod'
import { datasetLicenseIdSchema } from './sourceMetadata.ts'

/** Geofabrik full-country extract used for OSM boundary tooling. */
export const GERMANY_OSM_PBF_BASENAME = 'germany-latest.osm.pbf'
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

export const DEFAULT_OSM_TAGS_FILTER_EXPRESSIONS = [
  'r/boundary=administrative',
  'w/boundary=administrative',
  'r/boundary=postal_code',
  'w/boundary=postal_code',
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
 * under `osm` (`downloadedAt`, `sourceDateSource`); merge with `buildResolvedOsmSourceSide`
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
