/** Pass as `id` on the Map and use `useMap()[COMPARISON_MAP_ID]` from siblings inside `MapProvider`. */
export const COMPARISON_MAP_ID = 'comparison'

export const SOURCE_ID = 'comparison-pmtiles'
export const UNMATCHED_SOURCE_ID = 'comparison-unmatched-pmtiles'
/** Second vector source: diff-only PMTiles (detail map; display-only layers). */
export const DIFF_SOURCE_ID = 'comparison-diff-pmtiles'

/** Fills only: sibling line layers use the same promoted `featureId`. */
export const COMPARISON_INTERACTIVE_LAYER_IDS = [
  `${SOURCE_ID}-overlay-official-fill`,
  `${SOURCE_ID}-overlay-official-only-fill`,
  `${SOURCE_ID}-overlay-osm-fill`,
] as const

export const UNMATCHED_INTERACTIVE_LAYER_IDS = [`${UNMATCHED_SOURCE_ID}-overlay-osm-fill`] as const

export const ALL_INTERACTIVE_LAYER_IDS = [
  ...COMPARISON_INTERACTIVE_LAYER_IDS,
  ...UNMATCHED_INTERACTIVE_LAYER_IDS,
] as const

/** OpenFreeMap — Positron (light), no API key. https://openfreemap.org/quick_start */
export const COMPARISON_BASEMAP_STYLE = 'https://tiles.openfreemap.org/styles/positron'
