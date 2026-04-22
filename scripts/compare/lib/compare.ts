import { existsSync } from 'node:fs'
import { join } from 'node:path'
import * as turf from '@turf/turf'
import type { BBox, Feature, Geometry } from 'geojson'
import { datasetFolderPath } from '../../shared/datasetPaths.ts'
import type { BoundaryConfig } from './config.ts'
import { loadBoundaryConfig, osmFgbPathFromConfig } from './config.ts'
import { unionFeaturesByKey } from './geoMerge.ts'
import { loadFeatureCollection } from './loadFeatureCollection.ts'
import { calculateMetrics, type MetricResult } from './metrics.ts'
import { normalizeOfficialValue, normalizeOsmValue } from './normalizeGermanKey.ts'
import { officialPropertyToMatchKey } from './officialKeyTransposition.ts'
import { projectGeometry } from './projectGeometry.ts'

export type CompareRow = {
  canonicalMatchKey: string
  nameLabel: string
  category: 'matched' | 'official_only'
  osmRelationId: string
  metrics: MetricResult | null
  officialGeometryWgs84: Geometry | null
  osmGeometryWgs84: Geometry | null
  /** GeoJSON properties from the merged official feature(s) for this key. */
  officialProperties: Record<string, unknown> | null
  /** GeoJSON properties from the merged OSM feature(s) for this key. */
  osmProperties: Record<string, unknown> | null
}

export type UnmatchedOsmRow = {
  canonicalMatchKey: string
  nameLabel: string
  osmRelationId: string
  adminLevel: string | null
  osmGeometryWgs84: Geometry | null
}

function pickOsmRelationId(featureIds: string[]): string {
  const rel = featureIds.find((id) => id.startsWith('relation/'))
  if (rel) return rel.replace('relation/', '')
  return featureIds[0] ?? ''
}

function readAdminLevel(props: Record<string, unknown> | null): string | null {
  if (!props) return null
  const v = props.admin_level
  if (v == null) return null
  const s = String(v).trim()
  return s.length > 0 ? s : null
}

function mergeBboxes(a: BBox, b: BBox): BBox {
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]
}

function expandBbox(b: BBox, bufferDeg: number): BBox {
  return [b[0] - bufferDeg, b[1] - bufferDeg, b[2] + bufferDeg, b[3] + bufferDeg]
}

function bboxesOverlap(a: BBox, b: BBox): boolean {
  return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3])
}

function unionOfficialBbox(features: Feature[]): BBox | null {
  let acc: BBox | null = null
  for (const f of features) {
    if (!f.geometry) continue
    const bb = turf.bbox(f as Feature)
    acc = acc ? mergeBboxes(acc, bb) : bb
  }
  return acc
}

function filterOsmByOfficialBbox(
  osmFeatures: Feature[],
  officialUnion: BBox,
  bufferDeg: number,
): Feature[] {
  const pad = expandBbox(officialUnion, bufferDeg)
  return osmFeatures.filter((f) => {
    if (!f.geometry) return false
    const bb = turf.bbox(f as Feature)
    return bboxesOverlap(pad, bb)
  })
}

const DEFAULT_BBOX_BUFFER_DEG = 0.05

function parseRelationId(rawId: unknown): string | null {
  const id = typeof rawId === 'string' ? rawId.trim() : ''
  if (!id.startsWith('relation/')) return null
  const relId = id.slice('relation/'.length).trim()
  return relId.length > 0 ? relId : null
}

export async function runCompare(
  runtimeRoot: string,
  areaFolder: string,
  configRaw: unknown,
): Promise<{
  config: BoundaryConfig
  rows: CompareRow[]
  unmatchedOsm: UnmatchedOsmRow[]
  metricsCrs: string
}> {
  const config = loadBoundaryConfig(configRaw, `${areaFolder}`)
  const areaPath = datasetFolderPath(runtimeRoot, areaFolder)
  const officialPath = join(areaPath, config.official.path)
  const osmPath = osmFgbPathFromConfig(runtimeRoot, config.osm)
  if (!existsSync(osmPath)) {
    throw new Error(
      `Configured OSM FlatGeobuf not found:\n  ${osmPath}\n\nRun: bun run osm:extract`,
    )
  }
  const osmMatchProperty = config.osm.matchProperty
  const relationIdCriteria =
    config.osm.matchCriteria?.kind === 'relation_id'
      ? new Set(config.osm.matchCriteria.relationIds)
      : null
  const preset = config.idNormalization.preset
  const metricsCrs = config.metricsCrs

  const officialFc = await loadFeatureCollection(officialPath)
  let osmFc = await loadFeatureCollection(osmPath)

  if (config.compare?.applyBboxFilter) {
    const ob = unionOfficialBbox(officialFc.features)
    if (!ob) {
      throw new Error(
        `${areaFolder}: compare.applyBboxFilter is true but official features have no geometries to derive a bbox`,
      )
    }
    const buf =
      config.compare.bboxBufferDegrees !== undefined
        ? config.compare.bboxBufferDegrees
        : DEFAULT_BBOX_BUFFER_DEG
    const filtered = filterOsmByOfficialBbox(osmFc.features, ob, buf)
    osmFc = { type: 'FeatureCollection', features: filtered }
  }

  const officialMap = unionFeaturesByKey(officialFc, (props) => {
    if (config.official.constantMatchKey) {
      return normalizeOfficialValue(config.official.constantMatchKey, preset)
    }
    return officialPropertyToMatchKey(
      props as Record<string, unknown> | null,
      config.official.matchProperty,
      config.official.keyTransposition,
      preset,
    )
  })

  const osmMap = unionFeaturesByKey(osmFc, (props) => {
    const p = props as Record<string, unknown>
    if (relationIdCriteria) {
      const relId = parseRelationId(p?.['@id'])
      if (!relId || !relationIdCriteria.has(relId)) return null
      return normalizeOsmValue('osm_relation_id', relId, preset).canonicalMatchKey
    }
    const v = p?.[osmMatchProperty]
    if (v == null) return null
    return normalizeOsmValue(osmMatchProperty, String(v), preset).canonicalMatchKey
  })

  const osmNameByKey = new Map<string, string>()
  for (const f of osmFc.features) {
    const props = f.properties as Record<string, unknown>
    let canonicalKey: string | null = null
    if (relationIdCriteria) {
      const relId = parseRelationId(props?.['@id'])
      if (!relId || !relationIdCriteria.has(relId)) continue
      canonicalKey = normalizeOsmValue('osm_relation_id', relId, preset).canonicalMatchKey
    } else {
      const v = props?.[osmMatchProperty]
      if (v == null) continue
      canonicalKey = normalizeOsmValue(osmMatchProperty, String(v), preset).canonicalMatchKey
    }
    if (canonicalKey == null || canonicalKey.length === 0) continue
    const nm = (f.properties as Record<string, unknown>)?.name
    if (typeof nm === 'string' && nm && !osmNameByKey.has(canonicalKey)) {
      osmNameByKey.set(canonicalKey, nm)
    }
  }

  const officialKeys = Array.from(officialMap.keys()).sort()
  const rows: CompareRow[] = []

  for (const key of officialKeys) {
    const o = officialMap.get(key)
    const s = osmMap.get(key)
    const officialGeom = o?.geometry ?? null
    const osmGeom = s?.geometry ?? null
    const nameLabel = osmNameByKey.get(key) ?? key

    const category: CompareRow['category'] = officialGeom && osmGeom ? 'matched' : 'official_only'

    const osmRelationId = osmGeom ? pickOsmRelationId(s?.featureIds ?? []) : ''

    let metrics: MetricResult | null = null
    if (category === 'matched' && officialGeom && osmGeom) {
      const op = projectGeometry(officialGeom, metricsCrs)
      const sp = projectGeometry(osmGeom, metricsCrs)
      metrics = calculateMetrics(op, sp)
    }

    rows.push({
      canonicalMatchKey: key,
      nameLabel,
      category,
      osmRelationId,
      metrics,
      officialGeometryWgs84: officialGeom,
      osmGeometryWgs84: osmGeom,
      officialProperties: o?.properties ?? null,
      osmProperties: s?.properties ?? null,
    })
  }

  const officialKeySet = new Set(officialMap.keys())
  const unmatchedOsm: UnmatchedOsmRow[] = []
  for (const key of Array.from(osmMap.keys()).sort()) {
    if (officialKeySet.has(key)) continue
    const s = osmMap.get(key)
    if (!s) continue
    const props = s.properties as Record<string, unknown> | null
    const nameLabel =
      typeof props?.name === 'string' && props.name.trim().length > 0
        ? props.name.trim()
        : (osmNameByKey.get(key) ?? key)
    unmatchedOsm.push({
      canonicalMatchKey: key,
      nameLabel,
      osmRelationId: pickOsmRelationId(s.featureIds),
      adminLevel: readAdminLevel(props),
      osmGeometryWgs84: s.geometry ?? null,
    })
  }

  return { config, rows, unmatchedOsm, metricsCrs }
}
