import type { Feature, MultiPolygon, Polygon } from 'geojson'
import { Layer, Source } from 'react-map-gl/maplibre'
import { stateMaskFeatureCollection } from '../../lib/stateFilter'

const MASK_SOURCE_ID = 'state-mask'
const OUTLINE_SOURCE_ID = 'state-outline'

/**
 * State filter focus: dims everything outside the chosen Land and draws its border. The
 * boundaries outside stay on the map (and clickable) under the dimming.
 */
export function StateMaskLayers({ outline }: { outline: Feature<Polygon | MultiPolygon> | null }) {
  if (!outline) return null
  return (
    <>
      <Source id={MASK_SOURCE_ID} type="geojson" data={stateMaskFeatureCollection(outline)}>
        <Layer
          id={`${MASK_SOURCE_ID}-fill`}
          type="fill"
          source={MASK_SOURCE_ID}
          paint={{ 'fill-color': '#020617', 'fill-opacity': 0.7 }}
        />
      </Source>
      <Source id={OUTLINE_SOURCE_ID} type="geojson" data={outline}>
        <Layer
          id={`${OUTLINE_SOURCE_ID}-line`}
          type="line"
          source={OUTLINE_SOURCE_ID}
          paint={{ 'line-color': '#7dd3fc', 'line-width': 1.5, 'line-opacity': 0.8 }}
        />
      </Source>
    </>
  )
}
