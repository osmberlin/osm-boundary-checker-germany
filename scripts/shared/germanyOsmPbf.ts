/** Geofabrik full-country extract used for OSM boundary tooling. */
export const GERMANY_OSM_PBF_URL = 'https://download.geofabrik.de/europe/germany-latest.osm.pbf'

/** Under workspace root; already covered by repo `.gitignore` (`.cache/`). */
export const GERMANY_OSM_CACHE_DIR = '.cache/osm'

export const GERMANY_OSM_PBF_BASENAME = 'germany-latest.osm.pbf'

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
