import type { FeatureCollection } from 'geojson'

/**
 * Tippecanoe refuses an empty FeatureCollection ("Did not read any valid geometries").
 * When the compare run has overlay polygons but no drawable symmetric-diff polygons, we
 * still emit `output/comparison-diff.pmtiles` by encoding this single **Point** at the
 * overlay bbox north-east corner. It uses a `featureId` that never appears in real rows,
 * so MapLibre `featureId` filters hide it. Diff layers are fill/line only, so the point
 * does not render.
 */
export const COMPARISON_DIFF_EMPTY_PLACEHOLDER_FEATURE_ID = '__empty_diff_placeholder__'

/** WGS84 bbox `[west, south, east, north]` from e.g. `@turf/bbox` over overlay features. */
export function comparisonDiffPlaceholderFeatureCollection(
  overlayBboxWgs84: [number, number, number, number],
): FeatureCollection {
  const [, , east, north] = overlayBboxWgs84
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          featureId: COMPARISON_DIFF_EMPTY_PLACEHOLDER_FEATURE_ID,
          boundarySource: 'external',
          mapRole: 'diff',
        },
        geometry: {
          type: 'Point',
          coordinates: [east, north],
        },
      },
    ],
  }
}
