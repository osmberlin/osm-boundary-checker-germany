import { join } from 'node:path'
import {
  GERMANY_OSM_CACHE_DIR,
  GERMANY_OSM_SHARED_FGB_BASENAME,
} from '../../shared/germanyOsmPbf.ts'

export type IdNormalizationPreset = 'berlin-bezirk-ags' | 'amtlicher-8' | 'regional-12'

/** OSM tagging: fixed project-wide (all areas use the same column in GDAL output). */
export const OSM_MATCH_PROPERTY = 'de:regionalschluessel'

/** Paths under the area folder for official input only; OSM is always the shared cache FGB. */
export type BoundaryConfig = {
  official: { path: string; matchProperty: string }
  idNormalization: { preset: IdNormalizationPreset }
  metricsCrs: string
}

export function loadBoundaryConfig(json: unknown): BoundaryConfig {
  const c = json as BoundaryConfig
  if (!c?.official?.path || !c?.official?.matchProperty) {
    throw new Error('Invalid area config: missing official.path or official.matchProperty')
  }
  if (!c?.idNormalization?.preset || !c?.metricsCrs) {
    throw new Error('Invalid area config: missing idNormalization.preset or metricsCrs')
  }
  return c
}

/** Repo-root path to the shared OSM FlatGeobuf (`bun run osm:extract`). */
export function sharedGermanyOsmFgbPath(repoRoot: string): string {
  return join(repoRoot, GERMANY_OSM_CACHE_DIR, GERMANY_OSM_SHARED_FGB_BASENAME)
}
