/**
 * Single source for comparison map paint (ComparisonVectorLayers).
 * Category pills / legend swatches: `reportCategoryStyles.tsx` (reuses these values).
 */
export const mapLayerColors = {
  official: {
    fill: '#2563eb',
    fillOpacity: 0.2,
    line: '#1d4ed8',
  },
  osm: {
    fill: '#ea580c',
    fillOpacity: 0.15,
    line: '#c2410c',
  },
  /** Symmetric-diff patches: source = blue, OSM = red */
  diff: {
    official: {
      fill: '#2563eb',
      fillOpacity: 0.92,
      line: '#1d4ed8',
      lineOpacity: 0.38,
    },
    osm: {
      fill: '#dc2626',
      fillOpacity: 0.9,
      line: '#b91c1c',
      lineOpacity: 0.38,
    },
    /** Outer halo width (px); offset in MapPane is half so stroke sits outside the fill. */
    lineWidth: 12,
  },
} as const
