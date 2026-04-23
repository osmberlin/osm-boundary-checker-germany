import { detectSiteBasePath, withSiteBasePath } from '../lib/siteBasePath'
import type { ReportRow } from '../types/report'

/** Keep browser runtime independent from Node-only `scripts/shared/datasetPaths.ts`. */
const DATASETS_DIRECTORY = 'datasets'

/**
 * Static routes:
 * - `/areas.gen.json` for home summaries
 * - `/datasets/*` for PMTiles + generated API JSON payloads + official_for_edit artifacts
 */
/** Runtime API endpoint for home area index and summaries. */
export function areasIndexUrl(): string {
  return withSiteBasePath('/areas.gen.json')
}

export function processingStateUrl(): string {
  return withSiteBasePath('/data/processing-state.json')
}

export function processingLogJsonlUrl(): string {
  return withSiteBasePath('/data/processing-log.jsonl')
}

function datasetDataPath(area: string, rel: string): string {
  return withSiteBasePath(`/${DATASETS_DIRECTORY}/${area}/${rel}`)
}

/** Path to PMTiles under the dev server (same origin). */
export function comparisonPmtilesPath(area: string) {
  return datasetDataPath(area, 'output/comparison.pmtiles')
}

/** MapLibre vector source URL using the registered `pmtiles://` protocol. */
export function comparisonPmtilesMaplibreUrl(area: string): string {
  const path = comparisonPmtilesPath(area)
  return `pmtiles://${window.location.origin}${path}`
}

/** Latest-only: `output/unmatched.pmtiles` (no historic per-snapshot file). */
export function comparisonUnmatchedPmtilesPath(area: string): string {
  return datasetDataPath(area, 'output/unmatched.pmtiles')
}

export function comparisonUnmatchedPmtilesMaplibreUrl(area: string): string {
  const path = comparisonUnmatchedPmtilesPath(area)
  return `pmtiles://${window.location.origin}${path}`
}

export function routerBasePath(): string {
  return detectSiteBasePath() || '/'
}

export function snapshotsUrl(area: string) {
  return datasetDataPath(area, 'snapshots.json')
}

export function comparisonApiUrl(area: string) {
  return datasetDataPath(area, 'output/comparison_table.json')
}

export function featureApiUrl(area: string, featureKey: string) {
  return datasetDataPath(area, `output/features/${encodeURIComponent(featureKey)}.json`)
}

export function unmatchedApiUrl(area: string) {
  return datasetDataPath(area, 'output/unmatched.json')
}

/** Public path for official-for-edit GeoJSON (leading slash, under site root). */
export function officialForEditGeojsonHref(area: string, row: ReportRow): string | null {
  const rel = row.officialForEditPath
  if (rel == null || rel === '') return null
  return datasetDataPath(area, rel)
}
