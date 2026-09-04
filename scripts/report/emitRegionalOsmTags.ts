import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { loadFeatureCollection } from '../compare/lib/loadFeatureCollection.ts'
import { GERMANY_OSM_CACHE_DIR, GERMANY_OSM_SHARED_FGB_BASENAME } from '../shared/germanyOsmPbf.ts'
import { collectRegionalOsmTags } from './regionalOsmTags.ts'

export function regionalOsmTagsCachePath(runtimeRoot: string): string {
  return join(runtimeRoot, GERMANY_OSM_CACHE_DIR, 'regional-osm-tags.json')
}

export function sharedAdminFgbPath(runtimeRoot: string): string {
  return join(runtimeRoot, GERMANY_OSM_CACHE_DIR, GERMANY_OSM_SHARED_FGB_BASENAME)
}

export async function emitRegionalOsmTagsSidecar(
  runtimeRoot: string,
  fgbPath = sharedAdminFgbPath(runtimeRoot),
): Promise<{ featureCount: number; arsCount: number; path: string } | null> {
  if (!existsSync(fgbPath)) return null
  const collection = await loadFeatureCollection(fgbPath)
  const payload = collectRegionalOsmTags(collection)
  const outPath = regionalOsmTagsCachePath(runtimeRoot)
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, `${JSON.stringify(payload)}\n`, 'utf8')
  return {
    featureCount: payload.featureCount,
    arsCount: Object.keys(payload.byArs).length,
    path: outPath,
  }
}
