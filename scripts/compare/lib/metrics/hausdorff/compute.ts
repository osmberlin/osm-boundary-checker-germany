import type { MultiPolygon, Polygon } from 'geojson'
import DiscreteHausdorffDistance from 'jsts/org/locationtech/jts/algorithm/distance/DiscreteHausdorffDistance.js'
import { geoReader } from '../sharedGeom.ts'

/** Discrete Hausdorff distance (m) between projected polygon geometries (JSTS). */
export function computeDiscreteHausdorffM(
  officialProjected: Polygon | MultiPolygon,
  osmProjected: Polygon | MultiPolygon,
): number {
  const g0 = geoReader.read(officialProjected)
  const g1 = geoReader.read(osmProjected)
  return DiscreteHausdorffDistance.distance(g0, g1)
}
