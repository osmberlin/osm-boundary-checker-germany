import { parseAsBoolean, useQueryStates } from 'nuqs'
import { useCallback, useMemo } from 'react'

const comparisonMapLayerParsers = {
  mapOfficial: parseAsBoolean.withDefault(true),
  mapOsm: parseAsBoolean.withDefault(true),
  mapDiff: parseAsBoolean.withDefault(false),
}

export function useComparisonMapLayers() {
  const [{ mapOfficial, mapOsm, mapDiff }, setLayers] = useQueryStates(comparisonMapLayerParsers, {
    history: 'replace',
  })

  const setShowOfficial = useCallback(
    (value: boolean) => {
      void setLayers({ mapOfficial: value })
    },
    [setLayers],
  )

  const setShowOsm = useCallback(
    (value: boolean) => {
      void setLayers({ mapOsm: value })
    },
    [setLayers],
  )

  const setShowDiff = useCallback(
    (value: boolean) => {
      void setLayers({ mapDiff: value })
    },
    [setLayers],
  )

  return useMemo(
    () => ({
      showOfficial: mapOfficial,
      showOsm: mapOsm,
      showDiff: mapDiff,
      setShowOfficial,
      setShowOsm,
      setShowDiff,
    }),
    [mapOfficial, mapOsm, mapDiff, setShowOfficial, setShowOsm, setShowDiff],
  )
}
