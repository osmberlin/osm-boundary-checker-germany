import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { Geometry } from 'geojson'
import { datasetFolderPath } from '../../shared/datasetPaths.ts'
import {
  germanStateByArsPrefix,
  statesFromOverlaps,
  type GermanStateCode,
} from '../../shared/germanStates.ts'
import { REGIONAL_LAENDER_AREA_ID } from '../../shared/regionalArs.ts'
import { loadFeatureCollection } from './loadFeatureCollection.ts'
import { stateOverlapWithRust } from './rustGeomSidecar.ts'

/**
 * Exact state polygons: the BKG VG25 Länder of the `de-laender` dataset, extracted before every
 * compare run. Land and coastal water come as separate features with the same `ARS`.
 */
export function stateSourcePath(runtimeRoot: string) {
  return join(datasetFolderPath(runtimeRoot, REGIONAL_LAENDER_AREA_ID), 'source', 'official.fgb')
}

export async function loadStateGeometries(runtimeRoot: string) {
  const path = stateSourcePath(runtimeRoot)
  if (!existsSync(path)) return null
  const fc = await loadFeatureCollection(path)
  const states: { code: GermanStateCode; geometry: Geometry }[] = []
  for (const feature of fc.features) {
    const ars = String(feature.properties?.ARS ?? '')
    const state = germanStateByArsPrefix(ars.slice(0, 2))
    if (!state || !feature.geometry) continue
    states.push({ code: state.code, geometry: feature.geometry })
  }
  return states.length > 0 ? states : null
}

/** States per geometry, in input order; `[]` for rows without geometry or outside all states. */
export function assignStates(
  states: { code: GermanStateCode; geometry: Geometry }[],
  geometries: (Geometry | null)[],
): GermanStateCode[][] {
  const overlaps = stateOverlapWithRust({ states, rows: geometries })
  return overlaps.map((row) =>
    statesFromOverlaps(
      row.overlaps.map((o) => ({ code: o.code as GermanStateCode, areaM2: o.areaM2 })),
      row.totalM2,
    ),
  )
}
