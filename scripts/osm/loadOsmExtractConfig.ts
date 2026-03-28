import { loadAreaConfig } from '../shared/areaConfig.ts'
import { DEFAULT_OSM_TAGS_FILTER_EXPRESSIONS } from '../shared/germanyOsmPbf.ts'

/**
 * Per-area extraction from a Germany (or other) `.osm.pbf` via osmium + ogr2ogr.
 * Defined under `osmExtract` in `config.jsonc`, or legacy `osm-extract.json`.
 */
export type OsmExtractConfig = {
  /**
   * OGR attribute filter on the OSM `multipolygons` layer (`-where`). Namespaced
   * keys need double quotes, e.g. `"de:regionalschluessel"`. Uses
   * `gdal-osm-boundaries.ini` so that tag is a column, not only `other_tags`.
   * Mutually exclusive with **`ogrSql`**.
   */
  ogrWhere?: string
  /**
   * SQLite dialect `-sql` against `multipolygons` (no separate layer arg). Use when
   * you must synthesize columns (e.g. **`de-staat`**: Germany has no
   * `de:regionalschluessel` on the `admin_level=2` relation). Mutually exclusive
   * with **`ogrWhere`**.
   */
  ogrSql?: string
  /** GDAL OSM layer name; almost always `multipolygons` for admin areas. */
  ogrLayer?: string
  /**
   * `osmium tags-filter` expressions after the input path.
   * Default: administrative boundary relations and ways.
   */
  tagsFilterExpressions?: string[]
  /**
   * If true, pass `-R` / `--omit-referenced` to osmium (faster, single pass).
   * Do not use for building closed polygons from relations.
   */
  omitReferenced?: boolean
  /** Optional `ogr2ogr -spat` as [minX, minY, maxX, maxY] in WGS84 (lon/lat). */
  ogrSpat?: [number, number, number, number]
}

export function parseOsmExtractSection(area: string, raw: unknown): OsmExtractConfig {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`${area}: osmExtract must be an object`)
  }
  const r = raw as OsmExtractConfig
  const hasWhere = typeof r.ogrWhere === 'string' && r.ogrWhere.trim() !== ''
  const hasSql = typeof r.ogrSql === 'string' && r.ogrSql.trim() !== ''
  if (hasWhere && hasSql) {
    throw new Error(`${area}: use only one of osmExtract.ogrWhere or osmExtract.ogrSql`)
  }
  if (!hasWhere && !hasSql) {
    throw new Error(`${area}: osmExtract needs non-empty ogrWhere or ogrSql`)
  }
  return r
}

export function loadOsmExtractConfig(workspaceRoot: string, area: string): OsmExtractConfig {
  const doc = loadAreaConfig(workspaceRoot, area) as Record<string, unknown>
  const oe = doc.osmExtract
  if (oe === undefined) {
    throw new Error(`${area}: missing osmExtract in config.jsonc (or legacy osm-extract.json)`)
  }
  return parseOsmExtractSection(area, oe)
}

export function resolvedTagsFilterExpressions(cfg: OsmExtractConfig): string[] {
  if (cfg.tagsFilterExpressions?.length) return cfg.tagsFilterExpressions
  return [...DEFAULT_OSM_TAGS_FILTER_EXPRESSIONS]
}

export function resolvedOgrLayer(cfg: OsmExtractConfig): string {
  return cfg.ogrLayer?.trim() || 'multipolygons'
}
