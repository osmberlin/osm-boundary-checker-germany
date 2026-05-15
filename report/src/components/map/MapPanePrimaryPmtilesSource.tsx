import type { ExpressionSpecification } from 'maplibre-gl'
import { mapLayerColors } from '../mapLayerColors'
import { SOURCE_ID } from './comparisonMapConstants'
import {
  featureIdFilterExpr,
  filterOfficialOverlay,
  filterOsmOverlay,
  NEVER_MATCH_FILTER,
} from './comparisonMapFilters'
import { OSM_UNMATCHED_OVERLAY_STRIPE_PATTERN_ID } from './comparisonMapSprites'
import { ComparisonVectorLayers } from './ComparisonVectorLayers'
import { MapPaneOfficialOnlyOverlayLayers } from './MapPaneOfficialOnlyOverlayLayers'

type PrimaryPmtilesConfig = {
  pmtilesUrl: string
  sourceLayer: string
  allowedFeatureIds?: string[] | null
  officialOnlyFeatureIds?: string[] | null
}

/** Primary comparison PMTiles {@link SOURCE_ID} plus matched overlay layers and optional official-only stack. */
export function MapPanePrimaryPmtilesSource({
  primary,
  featureId,
  showOfficial,
  showOsm,
  isStripePatternReady,
}: {
  primary: PrimaryPmtilesConfig
  featureId: string | null
  showOfficial: boolean
  showOsm: boolean
  isStripePatternReady: boolean
}) {
  const featureIdExpr = featureIdFilterExpr(featureId, primary.allowedFeatureIds ?? null)
  const officialOnlyFeatureIds = primary.officialOnlyFeatureIds ?? []
  const officialOverlayFilterExpr = filterOfficialOverlay(featureIdExpr)
  const officialOnlyListFilter: ExpressionSpecification =
    officialOnlyFeatureIds.length === 0
      ? NEVER_MATCH_FILTER
      : ([
          'in',
          ['get', 'featureId'],
          ['literal', officialOnlyFeatureIds],
        ] as ExpressionSpecification)
  const officialMatchedFilter: ExpressionSpecification = [
    'all',
    officialOverlayFilterExpr,
    ['!', officialOnlyListFilter],
  ] as ExpressionSpecification

  return (
    <>
      <ComparisonVectorLayers
        sourceId={SOURCE_ID}
        pmtilesUrl={primary.pmtilesUrl}
        sourceLayer={primary.sourceLayer}
        filterOfficialOverlay={officialMatchedFilter}
        filterOsmOverlay={filterOsmOverlay(featureIdExpr)}
        showOfficial={showOfficial}
        showOsm={showOsm}
        osmOverlay={mapLayerColors.osmPaired}
        osmStripePatternId={OSM_UNMATCHED_OVERLAY_STRIPE_PATTERN_ID}
        stripePatternReady={isStripePatternReady}
      />
      <MapPaneOfficialOnlyOverlayLayers
        featureId={featureId}
        allowedFeatureIds={primary.allowedFeatureIds ?? null}
        officialOnlyFeatureIds={officialOnlyFeatureIds}
        sourceLayer={primary.sourceLayer}
        showOfficial={showOfficial}
      />
    </>
  )
}
