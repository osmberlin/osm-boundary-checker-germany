import type { ExpressionSpecification } from 'maplibre-gl'
import { Layer, Source } from 'react-map-gl/maplibre'
import { mapLayerColors } from '../mapLayerColors'
import { SOURCE_ID } from './comparisonMapConstants'

export function ComparisonVectorLayers({
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

  return (
    <Source id={SOURCE_ID} type="vector" url={pmtilesUrl}>
      <Layer
        id={`${SOURCE_ID}-overlay-official-fill`}
        type="fill"
        source={SOURCE_ID}
        source-layer={sourceLayer}
        filter={filterOfficialOverlay}
        layout={{ visibility: showOfficial ? 'visible' : 'none' }}
        paint={{
          'fill-color': o.fill,
          'fill-opacity': o.fillOpacity,
        }}
      />
      <Layer
        id={`${SOURCE_ID}-overlay-official-line`}
        type="line"
        source={SOURCE_ID}
        source-layer={sourceLayer}
        filter={filterOfficialOverlay}
        layout={{ visibility: showOfficial ? 'visible' : 'none' }}
        paint={{
          'line-color': o.line,
          'line-width': 2,
        }}
      />
      <Layer
        id={`${SOURCE_ID}-overlay-osm-fill`}
        type="fill"
        source={SOURCE_ID}
        source-layer={sourceLayer}
        filter={filterOsmOverlay}
        layout={{ visibility: showOsm ? 'visible' : 'none' }}
        paint={{
          'fill-color': s.fill,
          'fill-opacity': s.fillOpacity,
        }}
      />
      <Layer
        id={`${SOURCE_ID}-overlay-osm-line`}
        type="line"
        source={SOURCE_ID}
        source-layer={sourceLayer}
        filter={filterOsmOverlay}
        layout={{ visibility: showOsm ? 'visible' : 'none' }}
        paint={{
          'line-color': s.line,
          'line-width': 2,
        }}
      />
      <Layer
        id={`${SOURCE_ID}-diff-official-fill`}
        type="fill"
        source={SOURCE_ID}
        source-layer={sourceLayer}
        filter={filterOfficialDiff}
        layout={{ visibility: showDiff ? 'visible' : 'none' }}
        paint={{
          'fill-color': d.official.fill,
          'fill-opacity': d.official.fillOpacity,
        }}
      />
      <Layer
        id={`${SOURCE_ID}-diff-official-line`}
        type="line"
        source={SOURCE_ID}
        source-layer={sourceLayer}
        filter={filterOfficialDiff}
        layout={{
          visibility: showDiff ? 'visible' : 'none',
          'line-cap': 'round',
          'line-join': 'round',
        }}
        paint={{
          'line-color': d.official.line,
          'line-width': d.lineWidth,
          'line-opacity': d.official.lineOpacity,
          'line-offset': d.lineWidth / 2,
        }}
      />
      <Layer
        id={`${SOURCE_ID}-diff-osm-fill`}
        type="fill"
        source={SOURCE_ID}
        source-layer={sourceLayer}
        filter={filterOsmDiff}
        layout={{ visibility: showDiff ? 'visible' : 'none' }}
        paint={{
          'fill-color': d.osm.fill,
          'fill-opacity': d.osm.fillOpacity,
        }}
      />
      <Layer
        id={`${SOURCE_ID}-diff-osm-line`}
        type="line"
        source={SOURCE_ID}
        source-layer={sourceLayer}
        filter={filterOsmDiff}
        layout={{
          visibility: showDiff ? 'visible' : 'none',
          'line-cap': 'round',
          'line-join': 'round',
        }}
        paint={{
          'line-color': d.osm.line,
          'line-width': d.lineWidth,
          'line-opacity': d.osm.lineOpacity,
          'line-offset': d.lineWidth / 2,
        }}
      />
    </Source>
  )
}
