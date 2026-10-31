import { Layer, Source } from 'react-map-gl/maplibre'
import type { LiveOsmFeatureCollection } from '../../lib/postpass'
import { mapLayerColors } from '../mapLayerColors'

const LIVE_OSM_SOURCE_ID = 'live-osm-results'

export function LiveOsmOverlayLayers({ geojson }: { geojson: LiveOsmFeatureCollection | null }) {
  if (!geojson || geojson.features.length === 0) return null
  const c = mapLayerColors.liveOsm
  return (
    <Source id={LIVE_OSM_SOURCE_ID} type="geojson" data={geojson as GeoJSON.FeatureCollection}>
      <Layer
        id={`${LIVE_OSM_SOURCE_ID}-fill`}
        type="fill"
        source={LIVE_OSM_SOURCE_ID}
        paint={{
          'fill-color': c.fill,
          'fill-opacity': c.fillOpacity,
        }}
      />
      <Layer
        id={`${LIVE_OSM_SOURCE_ID}-line`}
        type="line"
        source={LIVE_OSM_SOURCE_ID}
        paint={{
          'line-color': c.line,
          'line-opacity': c.lineOpacity,
          'line-width': 2.5,
        }}
      />
      <Layer
        id={`${LIVE_OSM_SOURCE_ID}-label`}
        type="symbol"
        source={LIVE_OSM_SOURCE_ID}
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
