import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { Geometry } from 'geojson'
import { datasetFolderPath } from '../../shared/datasetPaths.ts'
import type { BoundaryConfig } from './config.ts'
import { loadBoundaryConfig, OSM_MATCH_PROPERTY, sharedGermanyOsmFgbPath } from './config.ts'
import { unionFeaturesByKey } from './geoMerge.ts'
import { loadFeatureCollection } from './loadFeatureCollection.ts'
import { calculateMetrics, type MetricResult } from './metrics.ts'
import { normalizeOfficialValue, normalizeOsmValue } from './normalizeGermanKey.ts'
import { projectGeometry } from './projectGeometry.ts'

export type CompareRow = {
  canonicalMatchKey: string
  nameLabel: string
  category: 'matched' | 'official_only'
  osmRelationId: string
  metrics: MetricResult | null
  officialGeometryWgs84: Geometry | null
  osmGeometryWgs84: Geometry | null
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

export async function runCompare(
  repoRoot: string,
  areaFolder: string,
  configRaw: unknown,
): Promise<{
  config: BoundaryConfig
  rows: CompareRow[]
  unmatchedOsm: UnmatchedOsmRow[]
  metricsCrs: string
}> {
  const config = loadBoundaryConfig(configRaw)
  const areaPath = datasetFolderPath(repoRoot, areaFolder)
  const officialPath = join(areaPath, config.official.path)
  const osmPath = sharedGermanyOsmFgbPath(repoRoot)
  if (!existsSync(osmPath)) {
    throw new Error(`Shared OSM FlatGeobuf not found:\n  ${osmPath}\n\nRun: bun run osm:extract`)
  }
  const preset = config.idNormalization.preset
  const metricsCrs = config.metricsCrs

  const [officialFc, osmFc] = await Promise.all([
    loadFeatureCollection(officialPath),
    loadFeatureCollection(osmPath),
  ])

  const officialMap = unionFeaturesByKey(officialFc, (props) => {
    const v = (props as Record<string, unknown>)?.[config.official.matchProperty]
    if (v == null) return null
    return normalizeOfficialValue(String(v), preset)
  })

  const osmMap = unionFeaturesByKey(osmFc, (props) => {
    const v = (props as Record<string, unknown>)?.[OSM_MATCH_PROPERTY]
    if (v == null) return null
    const n = normalizeOsmValue(OSM_MATCH_PROPERTY, String(v), preset)
    return n.canonicalMatchKey
  })

  const osmNameByKey = new Map<string, string>()
  for (const f of osmFc.features) {
    const v = (f.properties as Record<string, unknown>)?.[OSM_MATCH_PROPERTY]
    if (v == null) continue
    const n = normalizeOsmValue(OSM_MATCH_PROPERTY, String(v), preset)
    const nm = (f.properties as Record<string, unknown>)?.name
    if (typeof nm === 'string' && nm && !osmNameByKey.has(n.canonicalMatchKey)) {
      osmNameByKey.set(n.canonicalMatchKey, nm)
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
