import type { ExpressionSpecification } from 'maplibre-gl'

export const NEVER_MATCH_FILTER = ['==', ['literal', 1], 0] as ExpressionSpecification

/** Tiles without `mapRole` are treated as overlay (older PMTiles). */
export const OVERLAY_ROLE_FILTER = [
  'any',
  ['==', ['get', 'mapRole'], 'overlay'],
  ['!', ['has', 'mapRole']],
] as ExpressionSpecification

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
