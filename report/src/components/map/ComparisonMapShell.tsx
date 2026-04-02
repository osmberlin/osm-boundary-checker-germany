import type { ComponentProps, ReactNode } from 'react'
import { MapProvider } from 'react-map-gl/maplibre'
import MapPane from '../MapPane'
import { COMPARISON_MAP_ID } from './comparisonMapConstants'

type MapPaneProps = ComponentProps<typeof MapPane>

/**
 * Wraps the comparison map in react-map-gl `MapProvider` and sets a stable map `id` for `useMap()[COMPARISON_MAP_ID]`
 * or `useComparisonMap` from sibling/child components.
 *
 * @see https://visgl.github.io/react-map-gl/docs/api-reference/mapbox/map#mapprovider
 */
export default function ComparisonMapShell({
  children,
  ...mapPaneProps
}: MapPaneProps & { children?: ReactNode }) {
  return (
    <MapProvider>
      <div className="relative h-full w-full">
        <MapPane {...mapPaneProps} mapId={COMPARISON_MAP_ID} />
        {children}
      </div>
    </MapProvider>
  )
}
