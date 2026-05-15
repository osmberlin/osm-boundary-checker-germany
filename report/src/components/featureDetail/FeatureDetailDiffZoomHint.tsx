import { useMapViewParam } from '../../hooks/useMapViewParam'
import { de } from '../../i18n/de'
import { cn } from '../../lib/cn'

const DIFF_MAP_MIN_ZOOM = 12

/** Zoom for styling comes from the `map` search param via {@link useMapViewParam}. */
export function FeatureDetailDiffZoomHint() {
  const { mapView } = useMapViewParam()

  return (
    <span
      className={cn(
        'font-normal',
        mapView == null
          ? 'text-amber-800'
          : mapView.zoom < DIFF_MAP_MIN_ZOOM
            ? 'text-amber-700'
            : 'text-emerald-700',
      )}
      title={de.map.diffFromZoom12Short}
    >
      {de.map.diffFromZoom12Short}
    </span>
  )
}
