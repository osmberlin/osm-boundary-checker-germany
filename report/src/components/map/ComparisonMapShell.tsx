import { useState } from 'react'
import type { ComponentProps, ReactNode } from 'react'
import MapPane from '../MapPane'
import { COMPARISON_MAP_ID } from './comparisonMapConstants'
import { ComparisonMapZoomHintOverlay } from './ComparisonMapZoomHintOverlay'

type MapPaneProps = ComponentProps<typeof MapPane>

/**
 * Comparison map shell rendered under a parent `MapProvider`.
 * Uses a stable map `id` for `useMap()[COMPARISON_MAP_ID]` in sibling/child components.
 *
 * @see https://visgl.github.io/react-map-gl/docs/api-reference/mapbox/map#mapprovider
 */
export default function ComparisonMapShell({
  children,
  ...mapPaneProps
}: MapPaneProps & { children?: ReactNode }) {
  const [zoom, setZoom] = useState<number>(10)
  return (
    <div className="relative h-full w-full">
      <MapPane
        {...mapPaneProps}
        mapId={COMPARISON_MAP_ID}
        onZoomChange={(nextZoom) => setZoom(nextZoom)}
      />
      <ComparisonMapZoomHintOverlay zoom={zoom} />
      {children}
    </div>
  )
}
