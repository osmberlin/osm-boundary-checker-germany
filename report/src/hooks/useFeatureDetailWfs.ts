import { useQueries, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { type WfsLiveQueryInput, wfsLiveQueryOptions } from '../data/load'
import { buildWfsGetFeatureUrl, type WfsFeature } from '../lib/wfsGetFeature'
import type { OgcWfsInspectSource } from '../types/report'

type WfsStatus =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'done'; features: WfsFeature[] }

export function useFeatureDetailWfs(featureKey: string) {
  const queryClient = useQueryClient()
  const [inputsBySourceId, setInputsBySourceId] = useState<Record<string, WfsLiveQueryInput>>({})

  const activeInputs = useMemo(
    () =>
      Object.values(inputsBySourceId).filter(
        (input) => input != null && input.featureKey === featureKey,
      ),
    [featureKey, inputsBySourceId],
  )

  const queryResults = useQueries({
    queries: activeInputs.map((input) => ({
      ...wfsLiveQueryOptions(input),
      retry: false,
      enabled: true,
    })),
  })

  const slotBySourceId = useMemo(() => {
    const out: Record<string, WfsStatus> = {}
    for (let i = 0; i < activeInputs.length; i += 1) {
      const input = activeInputs[i]
      const query = queryResults[i]
      if (!input || !query) continue
      if (query.isPending) {
        out[input.sourceId] = { status: 'loading' }
        continue
      }
      if (query.isError) {
        out[input.sourceId] = {
          status: 'error',
          message: query.error instanceof Error ? query.error.message : String(query.error),
        }
        continue
      }
      out[input.sourceId] = {
        status: 'done',
        features: query.data?.features ?? [],
      }
    }
    return out
  }, [activeInputs, queryResults])

  const loadSource = useCallback(
    async (source: OgcWfsInspectSource, bbox: [number, number, number, number]) => {
      const input: WfsLiveQueryInput = {
        featureKey,
        sourceId: source.id,
        requestUrl: buildWfsGetFeatureUrl(source, bbox),
      }
      setInputsBySourceId((prev) => ({ ...prev, [source.id]: input }))
      await queryClient.fetchQuery({
        ...wfsLiveQueryOptions(input),
        retry: false,
      })
    },
    [featureKey, queryClient],
  )

  const getStatus = useCallback(
    (sourceId: string): WfsStatus => {
      return slotBySourceId[sourceId] ?? { status: 'idle' }
    },
    [slotBySourceId],
  )

  const geojson = useMemo((): GeoJSON.FeatureCollection | null => {
    const features: GeoJSON.Feature[] = []
    for (const input of activeInputs) {
      if (!input) continue
      const slot = slotBySourceId[input.sourceId]
      if (!slot || slot.status !== 'done') continue
      for (const feature of slot.features) {
        if (!feature.geometry) continue
        const label =
          feature.id != null && feature.id !== ''
            ? String(feature.id)
            : feature.properties?.id != null
              ? String(feature.properties.id)
              : ''
        features.push({
          type: 'Feature',
          id: feature.id,
          geometry: feature.geometry,
          properties: {
            ...feature.properties,
            __wfsLabel: label,
          },
        })
      }
    }
    if (features.length === 0) return null
    return {
      type: 'FeatureCollection',
      features,
    }
  }, [activeInputs, slotBySourceId])

  return {
    loadSource,
    getStatus,
    geojson,
  }
}
