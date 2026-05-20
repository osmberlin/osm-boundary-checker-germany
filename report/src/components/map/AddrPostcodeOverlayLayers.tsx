import { Layer, Source } from 'react-map-gl/maplibre'
import { addrPostcodeColorMatchExpression } from '../../lib/addrPostcodeMapExpressions'
import type { AddrPostcodeGeoJsonFeatureCollection } from '../../lib/overpassAddrPostcode'
import { mapLayerColors } from '../mapLayerColors'

const ADDR_POSTCODE_SOURCE_ID = 'addr-postcode-live-results'

export function AddrPostcodeOverlayLayers({
  geojson,
}: {
  geojson: AddrPostcodeGeoJsonFeatureCollection | null
}) {
  if (!geojson || geojson.features.length === 0) return null
  const c = mapLayerColors.addrPostcode
  return (
    <Source id={ADDR_POSTCODE_SOURCE_ID} type="geojson" data={geojson as GeoJSON.FeatureCollection}>
      <Layer
        id={`${ADDR_POSTCODE_SOURCE_ID}-circle`}
        type="circle"
        source={ADDR_POSTCODE_SOURCE_ID}
        paint={{
          'circle-radius': c.circleRadius,
          'circle-color': addrPostcodeColorMatchExpression('point') as string,
          'circle-stroke-width': c.circleStrokeWidth,
          'circle-stroke-color': c.circleStrokeColor,
        }}
      />
      <Layer
        id={`${ADDR_POSTCODE_SOURCE_ID}-label`}
        type="symbol"
        source={ADDR_POSTCODE_SOURCE_ID}
        layout={{
          'text-field': ['get', 'label'],
          'text-size': 12,
          'text-font': ['Noto Sans Regular'],
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
          'text-allow-overlap': true,
        }}
        paint={{
          'text-color': addrPostcodeColorMatchExpression('label') as string,
          'text-halo-color': c.labelHalo,
          'text-halo-width': 1.2,
        }}
      />
    </Source>
  )
}
