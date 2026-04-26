import { Layer, Source } from 'react-map-gl/maplibre'
import type { OverpassGeoJsonFeatureCollection } from '../../lib/overpassBbox'
import { mapLayerColors } from '../mapLayerColors'

const OVERPASS_SOURCE_ID = 'overpass-live-results'

export function OverpassOverlayLayers({
  geojson,
}: {
  geojson: OverpassGeoJsonFeatureCollection | null
}) {
  if (!geojson || geojson.features.length === 0) return null
  const c = mapLayerColors.overpass
  return (
    <Source id={OVERPASS_SOURCE_ID} type="geojson" data={geojson as GeoJSON.FeatureCollection}>
      <Layer
        id={`${OVERPASS_SOURCE_ID}-fill`}
        type="fill"
        source={OVERPASS_SOURCE_ID}
        paint={{
          'fill-color': c.fill,
          'fill-opacity': c.fillOpacity,
        }}
      />
      <Layer
        id={`${OVERPASS_SOURCE_ID}-line`}
        type="line"
        source={OVERPASS_SOURCE_ID}
        paint={{
          'line-color': c.line,
          'line-opacity': c.lineOpacity,
          'line-width': 2.5,
        }}
      />
      <Layer
        id={`${OVERPASS_SOURCE_ID}-label`}
        type="symbol"
        source={OVERPASS_SOURCE_ID}
        layout={{
          'text-field': ['get', 'label'],
          'text-size': 12,
          'text-font': ['Noto Sans Regular'],
          'text-allow-overlap': false,
          'text-ignore-placement': false,
        }}
        paint={{
          'text-color': c.label,
          'text-halo-color': c.labelHalo,
          'text-halo-width': 1.2,
        }}
      />
    </Source>
  )
}
