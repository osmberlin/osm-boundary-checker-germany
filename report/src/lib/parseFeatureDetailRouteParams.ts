import { redirect } from '@tanstack/react-router'
import { areasIndex } from '../data/areasIndex'

/** Route id for `useParams({ from })` / `getRouteApi` on the feature detail leaf route. */
export const FEATURE_DETAIL_ROUTE_FROM = '/$areaId/feature/$featureKey' as const

const validAreaIds = new Set(areasIndex.areas)

/**
 * Path param guard for `/$areaId/feature/$featureKey`.
 * Invalid slugs never reach `FeatureDetail`; redirects match `beforeLoad` behavior elsewhere.
 */
export function parseFeatureDetailRouteParams(params: { areaId: string; featureKey: string }): {
  areaId: string
  featureKey: string
} {
  if (!validAreaIds.has(params.areaId)) {
    throw redirect({ to: '/' })
  }
  if (params.featureKey.trim() === '') {
    throw redirect({ to: '/$areaId', params: { areaId: params.areaId } })
  }
  return params
}
