import { useQueries, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { type WfsLiveQueryInput, wfsLiveQueryOptions } from '../data/load'
import { LIVE_ROW_KEY_PROPERTY, wfsFeatureIdPart, wfsLiveRowKey } from '../lib/liveRowKey'
import { buildWfsGetFeatureUrl, type WfsFeature } from '../lib/wfsGetFeature'
import type { OgcWfsInspectSource } from '../types/report'

const LIVE_STALE_TIME_MS = Number.POSITIVE_INFINITY

type WfsStatus =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'done'; features: WfsFeature[] }

/**
 * Live WFS: query keys include `requestUrl` (bbox-dependent). Each `loadSource(source, bbox)`
 * upserts that source’s observer input so TanStack cache and map overlays stay aligned with
 * the bbox used at load time.
 */
export function useFeatureDetailWfs({
  featureKey,
  sources,
}: {
  featureKey: string
  sources: readonly OgcWfsInspectSource[]
}) {
  const queryClient = useQueryClient()
  const [loadedInputs, setLoadedInputs] = useState<WfsLiveQueryInput[]>([])
  const [wfsLoadingSourceId, setWfsLoadingSourceId] = useState<string | null>(null)

  const queryResults = useQueries({
    queries: loadedInputs.map((input) => ({
      ...wfsLiveQueryOptions(input),
      enabled: false,
      staleTime: LIVE_STALE_TIME_MS,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      retry: false,
    })),
  })

  const slotBySourceId = useMemo(() => {
    const out: Record<string, WfsStatus> = {}
    const queryBySourceId = new Map<string, (typeof queryResults)[number]>()
    for (let i = 0; i < loadedInputs.length; i += 1) {
      const input = loadedInputs[i]
      const query = queryResults[i]
      if (input && query) queryBySourceId.set(input.sourceId, query)
    }
    for (const source of sources) {
      const query = queryBySourceId.get(source.id)
      if (!query) {
        out[source.id] =
          wfsLoadingSourceId === source.id ? { status: 'loading' } : { status: 'idle' }
        continue
      }
      if (query.data) {
        out[source.id] = { status: 'done', features: query.data.features }
        continue
      }
      if (query.isFetching || wfsLoadingSourceId === source.id) {
        out[source.id] = { status: 'loading' }
        continue
      }
      if (query.isError) {
        out[source.id] = {
          status: 'error',
          message: query.error instanceof Error ? query.error.message : String(query.error),
        }
        continue
      }
      out[source.id] = { status: 'idle' }
    }
    return out
  }, [sources, loadedInputs, queryResults, wfsLoadingSourceId])

  const loadSource = useCallback(
    async (source: OgcWfsInspectSource, bbox: [number, number, number, number]) => {
      const input: WfsLiveQueryInput = {
        featureKey,
        sourceId: source.id,
        requestUrl: buildWfsGetFeatureUrl(source, bbox),
      }
      setLoadedInputs((prev) => {
        const i = prev.findIndex((p) => p.sourceId === source.id)
        if (i === -1) return [...prev, input]
        const next = [...prev]
        next[i] = input
        return next
      })
      setWfsLoadingSourceId(source.id)
      try {
        await queryClient.fetchQuery({
          ...wfsLiveQueryOptions(input),
          staleTime: LIVE_STALE_TIME_MS,
          retry: false,
        })
      } finally {
        setWfsLoadingSourceId((id) => (id === source.id ? null : id))
      }
    },
    [featureKey, queryClient],
  )

  const getStatus = useCallback(
    (sourceId: string): WfsStatus => slotBySourceId[sourceId] ?? { status: 'idle' },
    [slotBySourceId],
  )

  const geojson = useMemo((): GeoJSON.FeatureCollection | null => {
    const features: GeoJSON.Feature[] = []
    for (const input of loadedInputs) {
      const slot = slotBySourceId[input.sourceId]
      if (!slot || slot.status !== 'done') continue
      slot.features.forEach((feature, indexInSource) => {
        if (!feature.geometry) return
        const label =
          feature.id != null && feature.id !== ''
            ? String(feature.id)
            : feature.properties?.id != null
              ? String(feature.properties.id)
              : ''
        const idPart = wfsFeatureIdPart(feature, indexInSource)
        features.push({
          type: 'Feature',
          id: feature.id,
          geometry: feature.geometry,
          properties: {
            ...feature.properties,
            __wfsLabel: label,
            [LIVE_ROW_KEY_PROPERTY]: wfsLiveRowKey(input.sourceId, idPart),
          },
        })
      })
    }
    if (features.length === 0) return null
    return {
      type: 'FeatureCollection',
      features,
    }
  }, [loadedInputs, slotBySourceId])

  return {
    loadSource,
    getStatus,
    geojson,
  }
}
