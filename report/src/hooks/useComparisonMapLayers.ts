import { useNavigate, useSearch } from '@tanstack/react-router'
import { useCallback, useMemo } from 'react'
import { z } from 'zod'

const boolSearchSchema = z
  .union([z.boolean(), z.string()])
  .transform((value) => value === true || value === 'true' || value === '1')

function parseBoolSearchValue(value: unknown, defaultValue: boolean): boolean {
  if (value == null) return defaultValue
  const parsed = boolSearchSchema.safeParse(value)
  return parsed.success ? parsed.data : defaultValue
}

export function useComparisonMapLayers() {
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as Record<string, unknown>
  const mapOfficial = parseBoolSearchValue(search.mapOfficial, true)
  const mapOsm = parseBoolSearchValue(search.mapOsm, true)
  const mapDiff = parseBoolSearchValue(search.mapDiff, false)

  const setShowOfficial = useCallback(
    (value: boolean) => {
      void navigate({
        search: ((prev: Record<string, unknown>) => ({
          ...prev,
          mapOfficial: value ? undefined : false,
        })) as never,
        replace: true,
      })
    },
    [navigate],
  )

  const setShowOsm = useCallback(
    (value: boolean) => {
      void navigate({
        search: ((prev: Record<string, unknown>) => ({
          ...prev,
          mapOsm: value ? undefined : false,
        })) as never,
        replace: true,
      })
    },
    [navigate],
  )

  const setShowDiff = useCallback(
    (value: boolean) => {
      void navigate({
        search: ((prev: Record<string, unknown>) => ({
          ...prev,
          mapDiff: value ? true : undefined,
        })) as never,
        replace: true,
      })
    },
    [navigate],
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
