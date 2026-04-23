import type { ExpressionSpecification } from 'maplibre-gl'
import { Layer, Source } from 'react-map-gl/maplibre'
import { mapLayerColors } from '../mapLayerColors'
import { SOURCE_ID } from './comparisonMapConstants'

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
}) {
  const o = mapLayerColors.official
  const s = mapLayerColors.osm
  const d = mapLayerColors.diff

  const hoveredExpr: ExpressionSpecification = ['boolean', ['feature-state', 'hover'], false]

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
          'fill-opacity': ['case', hoveredExpr, Math.min(1, o.fillOpacity + 0.18), o.fillOpacity],
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
          'line-width': ['case', hoveredExpr, 4, 2],
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
          'fill-color': s.fill,
          'fill-opacity': ['case', hoveredExpr, Math.min(1, s.fillOpacity + 0.2), s.fillOpacity],
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
