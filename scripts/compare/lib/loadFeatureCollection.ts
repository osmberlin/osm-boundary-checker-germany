import { readFileSync } from 'node:fs'
import { geojson } from 'flatgeobuf'
import type { Feature, FeatureCollection } from 'geojson'

/**
 * Load a FlatGeobuf file into a GeoJSON FeatureCollection in memory.
 * Official and OSM inputs must use `.fgb` (convert with GDAL: `ogr2ogr -f FlatGeobuf out.fgb in.geojson`).
 */
export async function loadFeatureCollection(path: string): Promise<FeatureCollection> {
  const lower = path.toLowerCase()
  if (!lower.endsWith('.fgb')) {
    throw new Error(
      `Expected FlatGeobuf (.fgb): ${path}. Convert: ogr2ogr -f FlatGeobuf out.fgb in.geojson`,
    )
  }
  const bytes = readFileSync(path)
  const features: Feature[] = []
  for await (const f of geojson.deserialize(bytes)) {
    features.push(f as Feature)
  }
  return { type: 'FeatureCollection', features }
}
