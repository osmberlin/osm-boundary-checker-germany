import { mapLayerColors } from '../mapLayerColors'
import { UNMATCHED_SOURCE_ID } from './comparisonMapConstants'
import { featureIdFilterExpr, filterOsmOverlay, NEVER_MATCH_FILTER } from './comparisonMapFilters'
import { OSM_UNMATCHED_OVERLAY_STRIPE_PATTERN_ID } from './comparisonMapSprites'
import { ComparisonVectorLayers } from './ComparisonVectorLayers'

type UnmatchedPmtilesConfig = {
  pmtilesUrl: string
  sourceLayer: string
  allowedFeatureIds?: string[] | null
  visible?: boolean
}

/**
 * Optional unmatched OSM PMTiles; unmounted when config is absent.
 * Source stays mounted when present so tiles stay cached; OSM overlay uses layout visibility via `visible`.
 */
export function MapPaneUnmatchedPmtilesSource({
  unmatched,
  featureId,
  isStripePatternReady,
}: {
  unmatched: UnmatchedPmtilesConfig | null | undefined
  featureId: string | null
  isStripePatternReady: boolean
}) {
  if (!unmatched) return null

  return (
    <ComparisonVectorLayers
      sourceId={UNMATCHED_SOURCE_ID}
      pmtilesUrl={unmatched.pmtilesUrl}
      sourceLayer={unmatched.sourceLayer}
      filterOfficialOverlay={NEVER_MATCH_FILTER}
      filterOsmOverlay={filterOsmOverlay(
        featureIdFilterExpr(featureId, unmatched.allowedFeatureIds ?? null),
      )}
      showOfficial={false}
      showOsm={unmatched.visible === true}
      osmOverlay={mapLayerColors.osmUnmatched}
      osmStripePatternId={OSM_UNMATCHED_OVERLAY_STRIPE_PATTERN_ID}
      stripePatternReady={isStripePatternReady}
    />
  )
}
