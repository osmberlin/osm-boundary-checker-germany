/** Digitize the Planet (DtP) API v2 constants shared by `dtp/download.ts` and its pure helpers. */

/** `DTP_API_BASE` in the environment points the sync elsewhere (pipeline tests of a failing API). */
export const DTP_API_BASE =
  process.env.DTP_API_BASE?.trim() || 'https://platform.digitizetheplanet.org/api/v2'

/** Germany in the DtP country list (`/countries`). */
export const DTP_COUNTRY_ID_GERMANY = 1

/**
 * The list defaults to managed areas only (5,183 of 24,663 in Germany, 2026-10-25). Unmanaged areas
 * have geometries too (BfN, EEA, Länder), just no rules maintained by an administration.
 */
export const DTP_INCLUDE_UNMANAGED = true

/** List endpoints return this many items per page; the API rejects `page_size`. */
export const DTP_LIST_PAGE_SIZE = 50

/**
 * Sweep order. The default (`-created_at`) is unstable: one bulk import shares a created_at for 259 areas,
 * so pages shift and 35 to 100 areas go missing per sweep. `area_in_km2` was complete in every test run.
 */
export const DTP_LIST_ORDERING = 'area_in_km2'
export const DTP_LIST_ORDERING_DESC = '-area_in_km2'

/**
 * Only the managed sweep (`include_unmanaged=false`) reads this: a list item carries no managed flag, so the
 * sweep returns just the uuids of the managed areas.
 */
export const DTP_MANAGED_SWEEP_FIELDS = 'uuid'

/**
 * Detail fields we need. Every name is listed in `schema.yaml` for `/protected-areas/{uuid}`.
 * `uuid` is not a detail field; the list item and the cache line carry it.
 * `responsible_organization_ids` is `[]` for unmanaged areas; managed areas get the organization ids.
 */
export const DTP_DETAIL_FIELDS = [
  'name',
  'category_id',
  'external_references',
  'state_ids',
  'parent_uuid',
  'updated_at',
  'area_in_km2',
  'geodata',
  'responsible_organization_ids',
].join(',')

export const DTP_CACHE_DIR = '.cache/dtp'
export const DTP_INVENTORY_FILE = 'inventory.json'
export const DTP_AREAS_FILE = 'areas.ndjson.gz'
export const DTP_DOWNLOAD_METADATA = 'download-metadata.json'
export const DTP_ORGANIZATIONS_FILE = 'organizations.json'
export const DTP_LICENSES_FILE = 'licenses.json'
export const DTP_GEOMETRY_SOURCES_FILE = 'geometry-sources.json'
export const DTP_CATEGORIES_FILE = 'protected-area-categories.json'

export const DTP_USER_AGENT =
  'osm-boundary-checker-germany (github.com/osmberlin/osm-boundary-checker-germany)'

export const DTP_DEFAULT_PAUSE_MS = 200
export const DTP_DEFAULT_MAX_DETAILS = 1500
/**
 * Share of a dataset's areas that may still lack a cached detail before extract leaves the
 * dataset out: while the first fill of the cache runs over several nights, a half-filled
 * dataset would show thousands of areas as missing in OSM.
 */
export const DTP_MAX_MISSING_SHARE = 0.01
export const DTP_DEFAULT_REVERIFY_DAYS = 28
export const DTP_DEFAULT_REVERIFY_MAX = 200
export const DTP_DELETED_LOOKBACK_DAYS = 30
export const DTP_PROGRESS_EVERY = 100
/**
 * Save the detail cache at most this often during a run (and always at the end or on error).
 * A full flush gzips ~500 MB (~5 s), so saving every DTP_PROGRESS_EVERY fetches would cost a
 * first fill about a sixth of its time; a killed run loses at most these minutes of fetches.
 */
export const DTP_FLUSH_EVERY_MS = 5 * 60_000
export const DTP_REQUEST_RETRIES = 3
