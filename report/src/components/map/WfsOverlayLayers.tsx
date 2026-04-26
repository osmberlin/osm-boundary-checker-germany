import { Layer, Source } from 'react-map-gl/maplibre'
import { mapLayerColors } from '../mapLayerColors'

const WFS_SOURCE_ID = 'wfs-live-results'

export function WfsOverlayLayers({ geojson }: { geojson: GeoJSON.FeatureCollection | null }) {
  if (!geojson || geojson.features.length === 0) return null
  const c = mapLayerColors.wfs
  return (
    <Source id={WFS_SOURCE_ID} type="geojson" data={geojson}>
      <Layer
        id={`${WFS_SOURCE_ID}-fill`}
        type="fill"
        source={WFS_SOURCE_ID}
        paint={{
          'fill-color': c.fill,
          'fill-opacity': c.fillOpacity,
        }}
      />
      <Layer
        id={`${WFS_SOURCE_ID}-line`}
        type="line"
        source={WFS_SOURCE_ID}
        paint={{
          'line-color': c.line,
          'line-opacity': c.lineOpacity,
          'line-width': 2.2,
        }}
      />
      <Layer
        id={`${WFS_SOURCE_ID}-label`}
        type="symbol"
        source={WFS_SOURCE_ID}
        layout={{
          'text-field': ['coalesce', ['get', '__wfsLabel'], ['to-string', ['id']]],
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
