import { useQueries, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
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
 * Live WFS state mirrors `useFeatureDetailOverpass`: deterministic query keys
 * built from `(featureKey, sourceId, requestUrl)` make every observer hit the
 * shared TanStack cache, so navigating away and back to a feature reads the
 * previous result without requiring another button click. No external state.
 */
export function useFeatureDetailWfs({
  featureKey,
  sources,
  bbox,
}: {
  featureKey: string
  sources: readonly OgcWfsInspectSource[]
  bbox: [number, number, number, number] | null
}) {
  const queryClient = useQueryClient()

  const inputs = useMemo<WfsLiveQueryInput[]>(() => {
    if (!bbox) return []
    return sources.map((source) => ({
      featureKey,
      sourceId: source.id,
      requestUrl: buildWfsGetFeatureUrl(source, bbox),
    }))
  }, [featureKey, sources, bbox])

  // Observers only — fetches are triggered explicitly via `loadSource`.
  const queryResults = useQueries({
    queries: inputs.map((input) => ({
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
    for (let i = 0; i < inputs.length; i += 1) {
      const input = inputs[i]
      const query = queryResults[i]
      if (!input || !query) continue
      if (query.data) {
        out[input.sourceId] = { status: 'done', features: query.data.features }
        continue
      }
      // `isFetching` (not `isPending`): the latter is true forever for
      // `enabled: false` queries that have never received data.
      if (query.isFetching) {
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
      out[input.sourceId] = { status: 'idle' }
    }
    return out
  }, [inputs, queryResults])

  const loadSource = useCallback(
    async (source: OgcWfsInspectSource) => {
      if (!bbox) return
      const input: WfsLiveQueryInput = {
        featureKey,
        sourceId: source.id,
        requestUrl: buildWfsGetFeatureUrl(source, bbox),
      }
      await queryClient.fetchQuery({
        ...wfsLiveQueryOptions(input),
        staleTime: LIVE_STALE_TIME_MS,
        retry: false,
      })
    },
    [featureKey, bbox, queryClient],
  )

  const getStatus = useCallback(
    (sourceId: string): WfsStatus => slotBySourceId[sourceId] ?? { status: 'idle' },
    [slotBySourceId],
  )

  const geojson = useMemo((): GeoJSON.FeatureCollection | null => {
    const features: GeoJSON.Feature[] = []
    for (const input of inputs) {
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
  }, [inputs, slotBySourceId])

  return {
    loadSource,
    getStatus,
    geojson,
  }
}
