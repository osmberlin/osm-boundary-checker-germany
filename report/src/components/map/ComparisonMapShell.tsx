import { useState } from 'react'
import type { ComponentProps, ReactNode } from 'react'
import { MapProvider } from 'react-map-gl/maplibre'
import { de } from '../../i18n/de'
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
  const [zoom, setZoom] = useState<number>(10)
  const zoomHint = zoom < 15 ? de.map.simplificationLikelyBelowZoom15 : de.map.fullDetailFromZoom15
  return (
    <MapProvider>
      <div className="relative h-full w-full">
        <MapPane
          {...mapPaneProps}
          mapId={COMPARISON_MAP_ID}
          onZoomChange={(nextZoom) => setZoom(nextZoom)}
        />
        <div className="pointer-events-none absolute right-3 bottom-3 max-w-xs rounded border border-slate-600 bg-slate-900/90 px-2 py-1 text-xs text-slate-200">
          {zoomHint}
        </div>
        {children}
      </div>
    </MapProvider>
  )
}
