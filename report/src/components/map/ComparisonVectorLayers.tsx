import type { ExpressionSpecification } from 'maplibre-gl'
import { Layer, Source } from 'react-map-gl/maplibre'
import { mapLayerColors } from '../mapLayerColors'
import { SOURCE_ID, UNMATCHED_SOURCE_ID } from './comparisonMapConstants'

export function ComparisonVectorLayers({
  sourceId = SOURCE_ID,
  pmtilesUrl,
  sourceLayer,
  filterOfficialOverlay,
  filterOsmOverlay,
  filterOfficialDiff,
  filterOsmDiff,
  showOfficial,
  showOsm,
  showDiff,
  osmOverlay,
  osmStripePatternId,
  stripePatternReady = true,
}: {
  sourceId?: string
  pmtilesUrl: string
  sourceLayer: string
  filterOfficialOverlay: ExpressionSpecification
  filterOsmOverlay: ExpressionSpecification
  filterOfficialDiff: ExpressionSpecification
  filterOsmDiff: ExpressionSpecification
  showOfficial: boolean
  showOsm: boolean
  showDiff: boolean
  osmOverlay: (typeof mapLayerColors)['osmPaired' | 'osmUnmatched']
  osmStripePatternId: string
  stripePatternReady?: boolean
}) {
  const o = mapLayerColors.officialMatched
  const s = osmOverlay
  const d = mapLayerColors.diff

  const hoveredExpr: ExpressionSpecification = ['boolean', ['feature-state', 'hover'], false]
  const useStripeFill = sourceId === UNMATCHED_SOURCE_ID && stripePatternReady
  const useSolidOsmFill = !useStripeFill

  return (
    <Source id={sourceId} type="vector" url={pmtilesUrl} promoteId="featureId">
      <Layer
        id={`${sourceId}-overlay-official-fill`}
        type="fill"
        source={sourceId}
        source-layer={sourceLayer}
        filter={filterOfficialOverlay}
        layout={{ visibility: showOfficial ? 'visible' : 'none' }}
        paint={{
          'fill-color': o.fill,
          'fill-opacity': 0,
        }}
      />
      <Layer
        id={`${sourceId}-overlay-official-line`}
        type="line"
        source={sourceId}
        source-layer={sourceLayer}
        filter={filterOfficialOverlay}
        layout={{ visibility: showOfficial ? 'visible' : 'none' }}
        paint={{
          'line-color': o.line,
          'line-width': ['case', hoveredExpr, 5.2, 2.6],
          // Nudge stroke inward by ~50% of its width so it remains visible under overlap styling.
          'line-offset': ['case', hoveredExpr, -2.6, -1.3],
        }}
      />
      <Layer
        id={`${sourceId}-overlay-osm-fill`}
        type="fill"
        source={sourceId}
        source-layer={sourceLayer}
        filter={filterOsmOverlay}
        layout={{ visibility: showOsm ? 'visible' : 'none' }}
        paint={{
          'fill-color': useSolidOsmFill ? s.line : s.fill,
          // Matched OSM uses transparent solid fill; stripe mode keeps base fill transparent.
          'fill-opacity': useSolidOsmFill
            ? ['case', hoveredExpr, Math.min(1, s.fillOpacity + 0.18), s.fillOpacity]
            : 0,
        }}
      />
      <Layer
        id={`${sourceId}-overlay-osm-fill-stripes`}
        type="fill"
        source={sourceId}
        source-layer={sourceLayer}
        filter={filterOsmOverlay}
        layout={{ visibility: showOsm && useStripeFill ? 'visible' : 'none' }}
        paint={{
          'fill-pattern': osmStripePatternId,
          'fill-opacity': [
            'case',
            hoveredExpr,
            Math.min(1, s.fillOpacity + 0.34),
            s.fillOpacity + 0.14,
          ],
        }}
      />
      <Layer
        id={`${sourceId}-overlay-osm-line`}
        type="line"
        source={sourceId}
        source-layer={sourceLayer}
        filter={filterOsmOverlay}
        layout={{ visibility: showOsm ? 'visible' : 'none' }}
        paint={{
          'line-color': s.line,
          'line-width': ['case', hoveredExpr, 4, 2],
        }}
      />
      <Layer
        id={`${sourceId}-diff-official-fill`}
        type="fill"
        source={sourceId}
        source-layer={sourceLayer}
        filter={filterOfficialDiff}
        layout={{ visibility: showDiff ? 'visible' : 'none' }}
        paint={{
          'fill-color': d.official.fill,
          'fill-opacity': [
            'case',
            hoveredExpr,
            Math.min(1, d.official.fillOpacity + 0.05),
            d.official.fillOpacity,
          ],
        }}
      />
      <Layer
        id={`${sourceId}-diff-official-line`}
        type="line"
        source={sourceId}
        source-layer={sourceLayer}
        filter={filterOfficialDiff}
        layout={{
          visibility: showDiff ? 'visible' : 'none',
          'line-cap': 'round',
          'line-join': 'round',
        }}
        paint={{
          'line-color': d.official.line,
          'line-width': ['case', hoveredExpr, d.lineWidth + 2, d.lineWidth],
          'line-opacity': d.official.lineOpacity,
          'line-offset': d.lineWidth / 2,
        }}
      />
      <Layer
        id={`${sourceId}-diff-osm-fill`}
        type="fill"
        source={sourceId}
        source-layer={sourceLayer}
        filter={filterOsmDiff}
        layout={{ visibility: showDiff ? 'visible' : 'none' }}
        paint={{
          'fill-color': d.osm.fill,
          'fill-opacity': [
            'case',
            hoveredExpr,
            Math.min(1, d.osm.fillOpacity + 0.05),
            d.osm.fillOpacity,
          ],
        }}
      />
      <Layer
        id={`${sourceId}-diff-osm-line`}
        type="line"
        source={sourceId}
        source-layer={sourceLayer}
        filter={filterOsmDiff}
        layout={{
          visibility: showDiff ? 'visible' : 'none',
          'line-cap': 'round',
          'line-join': 'round',
        }}
        paint={{
          'line-color': d.osm.line,
          'line-width': ['case', hoveredExpr, d.lineWidth + 2, d.lineWidth],
          'line-opacity': d.osm.lineOpacity,
          'line-offset': d.lineWidth / 2,
        }}
      />
    </Source>
  )
}
