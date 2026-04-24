import * as turf from '@turf/turf'
import type {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Geometry,
  MultiPolygon,
  Polygon,
} from 'geojson'
import { unionByKeyWithRust } from './rustGeomSidecar.ts'

export type KeyedGeometry = {
  key: string
  geometry: Geometry | null
  featureIds: string[]
  /**
   * GeoJSON properties from the first feature that contributed to this key.
   * When several features share a key, later features’ attributes are ignored (union is geometric only).
   */
  properties: Record<string, unknown> | null
}

function featurePolygon(
  geom: Polygon | MultiPolygon,
  props: GeoJsonProperties,
): Feature<Polygon | MultiPolygon> {
  return { type: 'Feature', properties: props ?? {}, geometry: geom }
}

/** Union all features sharing the same key; returns one MultiPolygon/Polygon or null. */
export function unionFeaturesByKey(
  fc: FeatureCollection,
  getKey: (props: GeoJsonProperties) => string | null,
): Map<string, KeyedGeometry> {
  const buckets = new Map<
    string,
    {
      geoms: Geometry[]
      featureIds: string[]
      properties: Record<string, unknown> | null
    }
  >()

  for (const f of fc.features) {
    const key = getKey(f.properties)
    if (key == null || key === '') continue
    const id =
      (f.properties as Record<string, unknown>)?.['@id'] != null
        ? String((f.properties as Record<string, unknown>)['@id'])
        : ''
    let b = buckets.get(key)
    if (!b) {
      b = { geoms: [], featureIds: [], properties: null }
      buckets.set(key, b)
    }
    if (
      b.properties === null &&
      f.properties != null &&
      typeof f.properties === 'object' &&
      !Array.isArray(f.properties)
    ) {
      b.properties = { ...(f.properties as Record<string, unknown>) }
    }
    if (f.geometry) {
      b.geoms.push(f.geometry)
      if (id && !b.featureIds.includes(id)) b.featureIds.push(id)
    }
  }

  const rustResults = unionByKeyWithRust(
    Array.from(buckets.entries()).map(([key, { geoms, featureIds, properties }]) => ({
      key,
      geometries: geoms,
      feature_ids: featureIds,
      properties,
    })),
  )
  if (rustResults) {
    const rustOut = new Map<string, KeyedGeometry>()
    for (const row of rustResults) {
      rustOut.set(row.key, {
        key: row.key,
        geometry: row.geometry,
        featureIds: row.feature_ids,
        properties: row.properties,
      })
    }
    return rustOut
  }

  const out = new Map<string, KeyedGeometry>()
  for (const [key, { geoms, featureIds, properties }] of buckets) {
    if (geoms.length === 0) {
      out.set(key, { key, geometry: null, featureIds, properties })
      continue
    }
    let merged: Polygon | MultiPolygon = geoms[0] as Polygon | MultiPolygon
    for (let i = 1; i < geoms.length; i++) {
      const g = geoms[i] as Polygon | MultiPolygon
      if (merged.type !== 'Polygon' && merged.type !== 'MultiPolygon') break
      if (g.type !== 'Polygon' && g.type !== 'MultiPolygon') continue
      try {
        const fc = turf.featureCollection([featurePolygon(merged, {}), featurePolygon(g, {})])
        const u = turf.union(fc)
        if (u?.geometry) merged = u.geometry
      } catch {
        /* keep merged */
      }
    }
    out.set(key, { key, geometry: merged, featureIds, properties })
  }
  return out
}
