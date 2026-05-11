import { useNavigate, useParams, useSearch } from '@tanstack/react-router'
import { FEATURE_DETAIL_ALL_BOUNDARIES_KEY } from '../lib/featureDetailSearch'
import { FEATURE_DETAIL_ROUTE_FROM } from '../lib/parseFeatureDetailRouteParams'

export function useFeatureDetailMapBoundaryScope() {
  const navigate = useNavigate()
  const { areaId, featureKey } = useParams({ from: FEATURE_DETAIL_ROUTE_FROM })
  const search = useSearch({ strict: false }) as Record<string, unknown>
  const showOnlySelected = search[FEATURE_DETAIL_ALL_BOUNDARIES_KEY] !== true

  function setShowOnlySelected(onlySelected: boolean) {
    void navigate({
      to: '/$areaId/feature/$featureKey',
      params: { areaId, featureKey },
      search: (prev: Record<string, unknown>) => {
        const next = { ...prev }
        if (onlySelected) {
          delete next[FEATURE_DETAIL_ALL_BOUNDARIES_KEY]
        } else {
          next[FEATURE_DETAIL_ALL_BOUNDARIES_KEY] = true
        }
        return next
      },
      replace: true,
      resetScroll: false,
    })
  }

  return { showOnlySelected, setShowOnlySelected }
}
