import type { ExpressionSpecification } from 'maplibre-gl'
import { Layer } from 'react-map-gl/maplibre'
import { mapLayerColors } from '../mapLayerColors'
import { SOURCE_ID } from './comparisonMapConstants'
import { featureIdFilterExpr, filterOfficialOverlay } from './comparisonMapFilters'

/** Extra fill/line on {@link SOURCE_ID} for “official only” features; unmounted when there are none. */
export function MapPaneOfficialOnlyOverlayLayers({
  featureId,
  allowedFeatureIds,
  officialOnlyFeatureIds,
  sourceLayer,
  showOfficial,
}: {
  featureId: string | null
  allowedFeatureIds?: string[] | null
  officialOnlyFeatureIds: string[]
  sourceLayer: string
  showOfficial: boolean
}) {
  if (officialOnlyFeatureIds.length === 0) return null

  const featureIdExpr = featureIdFilterExpr(featureId, allowedFeatureIds ?? null)
  const officialOverlayFilterExpr = filterOfficialOverlay(featureIdExpr)
  const officialOnlyListFilter: ExpressionSpecification = [
    'in',
    ['get', 'featureId'],
    ['literal', officialOnlyFeatureIds],
  ] as ExpressionSpecification
  const officialOnlyFilter: ExpressionSpecification = [
    'all',
    officialOverlayFilterExpr,
    officialOnlyListFilter,
  ] as ExpressionSpecification
  const hoverExpr: ExpressionSpecification = ['boolean', ['feature-state', 'hover'], false]
  const c = mapLayerColors.officialOnly

  return (
    <>
      <Layer
        id={`${SOURCE_ID}-overlay-official-only-fill`}
        type="fill"
        source={SOURCE_ID}
        source-layer={sourceLayer}
        filter={officialOnlyFilter}
        layout={{ visibility: showOfficial ? 'visible' : 'none' }}
        paint={{
          'fill-color': c.fill,
          'fill-opacity': ['case', hoverExpr, Math.min(1, c.fillOpacity + 0.18), c.fillOpacity],
        }}
      />
      <Layer
        id={`${SOURCE_ID}-overlay-official-only-line`}
        type="line"
        source={SOURCE_ID}
        source-layer={sourceLayer}
        filter={officialOnlyFilter}
        layout={{ visibility: showOfficial ? 'visible' : 'none' }}
        paint={{
          'line-color': c.line,
          'line-width': ['case', hoverExpr, 4, 2],
          'line-offset': ['case', hoverExpr, -2, -1],
        }}
      />
    </>
  )
}
