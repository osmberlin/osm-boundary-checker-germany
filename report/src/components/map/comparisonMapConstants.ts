/** Pass as `id` on the Map and use `useMap()[COMPARISON_MAP_ID]` from siblings inside `MapProvider`. */
export const COMPARISON_MAP_ID = 'comparison'

export const SOURCE_ID = 'comparison-pmtiles'

export const COMPARISON_INTERACTIVE_LAYER_IDS = [
  `${SOURCE_ID}-overlay-official-fill`,
  `${SOURCE_ID}-overlay-official-line`,
  `${SOURCE_ID}-overlay-osm-fill`,
  `${SOURCE_ID}-overlay-osm-line`,
  `${SOURCE_ID}-diff-official-fill`,
  `${SOURCE_ID}-diff-official-line`,
  `${SOURCE_ID}-diff-osm-fill`,
  `${SOURCE_ID}-diff-osm-line`,
] as const

/** OpenFreeMap — Positron (light), no API key. https://openfreemap.org/quick_start */
export const COMPARISON_BASEMAP_STYLE = 'https://tiles.openfreemap.org/styles/positron'
