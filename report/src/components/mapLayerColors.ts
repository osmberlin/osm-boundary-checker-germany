/**
 * Single source for comparison map paint ({@link ComparisonVectorLayers} and diff display layers).
 * Category pills / legend swatches: `reportCategoryStyles.tsx` (reuses these values).
 */
export const mapLayerColors = {
  officialMatched: {
    fill: '#65a30d',
    fillOpacity: 0.2,
    line: '#4d7c0f',
  },
  officialOnly: {
    fill: '#1d4ed8',
    fillOpacity: 0.2,
    line: '#1d4ed8',
  },
  osmPaired: {
    fill: '#fbbf24',
    fillOpacity: 0.15,
    line: '#f59e0b',
  },
  osmUnmatched: {
    fill: '#c2410c',
    fillOpacity: 0.15,
    line: '#c2410c',
  },
  overpass: {
    fill: '#701a75',
    fillOpacity: 0.2,
    line: '#86198f',
    lineOpacity: 0.9,
    label: '#f5d0fe',
    labelHalo: '#0f172a',
  },
  wfs: {
    fill: '#4c1d95',
    fillOpacity: 0.22,
    line: '#5b21b6',
    lineOpacity: 0.95,
    label: '#ddd6fe',
    labelHalo: '#0f172a',
  },
  /** Live addr:postcode points in viewport (palette bucket = last PLZ digit). */
  addrPostcode: {
    palette: [
      { point: '#f472b6', label: '#fbcfe8' },
      { point: '#2dd4bf', label: '#99f6e4' },
      { point: '#fb923c', label: '#fed7aa' },
      { point: '#e879f9', label: '#f5d0fe' },
      { point: '#38bdf8', label: '#bae6fd' },
      { point: '#a3e635', label: '#ecfccb' },
      { point: '#c084fc', label: '#e9d5ff' },
      { point: '#22d3ee', label: '#a5f3fc' },
      { point: '#f87171', label: '#fecaca' },
      { point: '#4ade80', label: '#bbf7d0' },
    ] as const,
    labelHalo: '#0f172a',
    circleRadius: 7,
    circleStrokeWidth: 1.5,
    circleStrokeColor: '#0f172a',
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
    lineWidth: 8,
  },
} as const
