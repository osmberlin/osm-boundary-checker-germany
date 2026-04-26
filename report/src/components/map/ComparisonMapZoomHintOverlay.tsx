import { InformationCircleIcon } from '@heroicons/react/20/solid'
import { useMap } from 'react-map-gl/maplibre'
import { de } from '../../i18n/de'
import { sharedButtonTinyClass } from '../sharedButtonStyles'
import { COMPARISON_MAP_ID } from './comparisonMapConstants'

const FULL_DETAIL_ZOOM = 15

export function ComparisonMapZoomHintOverlay({ zoom }: { zoom: number }) {
  const map = useMap()[COMPARISON_MAP_ID]
  const needsZoomIn = zoom < FULL_DETAIL_ZOOM
  if (!needsZoomIn) return null

  return (
    <div className="absolute top-3 left-3 max-w-xs rounded border border-slate-600 bg-slate-900/90 px-2 py-1 text-xs text-slate-200">
      <div className="inline-flex items-start gap-1.5">
        <InformationCircleIcon aria-hidden className="mt-0.5 size-3.5 shrink-0 text-sky-300" />
        <span className="inline">
          {de.map.simplificationLikelyBelowZoom15}{' '}
          <button
            type="button"
            className={sharedButtonTinyClass}
            disabled={!map}
            onClick={() => {
              const maplibre = map?.getMap()
              if (!maplibre) return
              maplibre.easeTo({ zoom: FULL_DETAIL_ZOOM, duration: 350 })
            }}
          >
            {de.map.zoomInForFullDetail}
          </button>
        </span>
      </div>
    </div>
  )
}
