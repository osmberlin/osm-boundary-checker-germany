import { useNavigate, useParams, useSearch } from '@tanstack/react-router'
import { FEATURE_DETAIL_ALL_BOUNDARIES_KEY } from '../lib/featureDetailSearch'

export function useFeatureDetailMapBoundaryScope() {
  const navigate = useNavigate()
  const params = useParams({ strict: false })
  const search = useSearch({ strict: false }) as Record<string, unknown>
  const showOnlySelected = search[FEATURE_DETAIL_ALL_BOUNDARIES_KEY] !== true

  function setShowOnlySelected(onlySelected: boolean) {
    const areaId = params.areaId
    const featureKey = params.featureKey
    if (areaId == null || featureKey == null) return

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
