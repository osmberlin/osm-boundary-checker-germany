import type { ExpressionSpecification } from 'maplibre-gl'

export const NEVER_MATCH_FILTER = ['==', ['literal', 1], 0] as ExpressionSpecification

/** Only explicit overlay features should be rendered in overlay layers. */
export const OVERLAY_ROLE_FILTER = ['==', ['get', 'mapRole'], 'overlay'] as ExpressionSpecification

export function featureIdFilterExpr(
  featureIdFocus: string | null,
  allowedFeatureIds: string[] | null,
): ExpressionSpecification | null {
  if (featureIdFocus !== null) {
    return ['==', ['get', 'featureId'], featureIdFocus]
  }
  if (allowedFeatureIds !== null) {
    if (allowedFeatureIds.length === 0) {
      return NEVER_MATCH_FILTER
    }
    return ['in', ['get', 'featureId'], ['literal', allowedFeatureIds]] as ExpressionSpecification
  }
  return null
}

function allWithOptionalFeature(
  featureIdExpr: ExpressionSpecification | null,
  parts: ExpressionSpecification[],
): ExpressionSpecification {
  const merged: ExpressionSpecification[] = featureIdExpr ? [featureIdExpr, ...parts] : [...parts]
  return ['all', ...merged]
}

export function filterOfficialOverlay(
  featureIdExpr: ExpressionSpecification | null,
): ExpressionSpecification {
  return allWithOptionalFeature(featureIdExpr, [
    OVERLAY_ROLE_FILTER,
    ['==', ['get', 'boundarySource'], 'external'],
  ])
}

export function filterOsmOverlay(
  featureIdExpr: ExpressionSpecification | null,
): ExpressionSpecification {
  return allWithOptionalFeature(featureIdExpr, [
    OVERLAY_ROLE_FILTER,
    ['==', ['get', 'boundarySource'], 'osm'],
  ])
}

export function filterOfficialDiff(
  featureIdExpr: ExpressionSpecification | null,
): ExpressionSpecification {
  // Real diff features use row keys as `featureId`. The empty-archive placeholder is a
  // Point with `COMPARISON_DIFF_EMPTY_PLACEHOLDER_FEATURE_ID` (see
  // scripts/shared/comparisonDiffPlaceholder.ts) and never passes `featureId` filters.
  return allWithOptionalFeature(featureIdExpr, [
    ['==', ['get', 'mapRole'], 'diff'],
    ['==', ['get', 'boundarySource'], 'external'],
  ])
}

export function filterOsmDiff(
  featureIdExpr: ExpressionSpecification | null,
): ExpressionSpecification {
  return allWithOptionalFeature(featureIdExpr, [
    ['==', ['get', 'mapRole'], 'diff'],
    ['==', ['get', 'boundarySource'], 'osm'],
  ])
}
