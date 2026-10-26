#!/usr/bin/env bun
/**
 * Wikidata items of German protected areas for the datasets with `compare.wikidata: true`.
 * Writes `data/wikidata/protected-areas.json` (runtime root); `compare-boundaries` embeds the items
 * DtP and OSM reference into the feature shards. Never fails the pipeline: without a fetch the
 * previous file stays.
 *
 *   bun run wikidata:protected-areas [--force]
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { loadFeatureCollection } from '../compare/lib/loadFeatureCollection.ts'
import { DTP_CACHE_DIR, DTP_INVENTORY_FILE } from '../dtp/lib/constants.ts'
import { dtpInventorySchema } from '../dtp/lib/schemas.ts'
import { areaHasCompareConfig, loadAreaConfig } from '../shared/areaConfig.ts'
import { DATASETS_DIRECTORY } from '../shared/datasetPaths.ts'
import { GERMANY_OSM_CACHE_DIR } from '../shared/germanyOsmPbf.ts'
import { resolveOsmProfile } from '../shared/osmProfiles.ts'
import { runtimeRootFromWorkspace } from '../shared/runtimeRoot.ts'
import {
  wikidataProtectedAreasFileSchema,
  type WikidataProtectedAreasFile,
} from '../shared/wikidataProtectedAreasPayload.ts'
import { workspaceRootFromHere } from '../shared/workspaceRoot.ts'
import { fetchWikidataProtectedAreas } from './wikidataProtectedAreas.ts'

export const WIKIDATA_PROTECTED_AREAS_RELATIVE_PATH = 'data/wikidata/protected-areas.json'

function log(message: string) {
  console.log(`[wikidata] ${message}`)
}

function readExisting(path: string): WikidataProtectedAreasFile | null {
  if (!existsSync(path)) return null
  try {
    const parsed = wikidataProtectedAreasFileSchema.safeParse(
      JSON.parse(readFileSync(path, 'utf8')),
    )
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

/** Datasets that opted in, with their DtP category selection and OSM profile. */
function optedInDatasets(workspaceRoot: string) {
  const root = join(workspaceRoot, DATASETS_DIRECTORY)
  if (!existsSync(root)) return []
  const out: Array<{ area: string; categoryIds: number[] | null; osmFgb: string }> = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue
    if (!areaHasCompareConfig(workspaceRoot, entry.name)) continue
    const config = loadAreaConfig(workspaceRoot, entry.name)
    if (!config.compare.wikidata) continue
    out.push({
      area: entry.name,
      categoryIds: config.officialMode === 'dtp' ? config.official.dtp.categoryIds : null,
      osmFgb: resolveOsmProfile(config.osmProfile).sharedFgbBasename,
    })
  }
  return out
}

/** Item ids that DtP (inventory references) and OSM (`wikidata` tag) name for the opted-in datasets. */
async function collectReferencedQids(workspaceRoot: string, runtimeRoot: string) {
  const datasets = optedInDatasets(workspaceRoot)
  const qids = new Set<string>()

  const inventoryPath = join(runtimeRoot, DTP_CACHE_DIR, DTP_INVENTORY_FILE)
  const dtpCategories = new Set(datasets.flatMap((dataset) => dataset.categoryIds ?? []))
  if (dtpCategories.size > 0 && existsSync(inventoryPath)) {
    const inventory = dtpInventorySchema.parse(JSON.parse(readFileSync(inventoryPath, 'utf8')))
    for (const item of inventory.items) {
      if (!dtpCategories.has(item.category_id)) continue
      for (const ref of item.external_references) {
        if (ref.name === 'wikidata' && ref.id.trim()) qids.add(ref.id.trim())
      }
    }
  }

  for (const basename of new Set(datasets.map((dataset) => dataset.osmFgb))) {
    const fgbPath = join(runtimeRoot, GERMANY_OSM_CACHE_DIR, basename)
    if (!existsSync(fgbPath)) continue
    const collection = await loadFeatureCollection(fgbPath)
    for (const feature of collection.features) {
      const value = feature.properties?.wikidata
      if (typeof value === 'string') {
        for (const part of value.split(';')) if (part.trim()) qids.add(part.trim())
      }
    }
  }
  return { datasets: datasets.map((dataset) => dataset.area), qids }
}

async function main() {
  const force = process.argv.includes('--force')
  const workspaceRoot = workspaceRootFromHere(import.meta.url)
  const runtimeRoot = runtimeRootFromWorkspace(workspaceRoot)
  const outPath = join(runtimeRoot, WIKIDATA_PROTECTED_AREAS_RELATIVE_PATH)

  const { datasets, qids } = await collectReferencedQids(workspaceRoot, runtimeRoot)
  if (datasets.length === 0) {
    log('no dataset has compare.wikidata: true, nothing to fetch')
    return
  }
  log(`${datasets.length} dataset(s), ${qids.size} referenced item id(s) in DtP/OSM`)

  const dump = await fetchWikidataProtectedAreas({
    existing: readExisting(outPath),
    referencedQids: qids,
    force,
  })
  if (!dump) {
    log('no data fetched and no earlier file; compare runs without Wikidata')
    return
  }
  log(
    `items=${dump.itemCount} referencedByQid=${dump.referencedCount} durationMs=${dump.durationMs}` +
      `${dump.splitByWdpaDigit ? ' split=wdpa-digit' : ''}${dump.skipReason ? ` skip=${dump.skipReason}` : ''}`,
  )
  if (dump.skipReason) return
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, `${JSON.stringify(dump)}\n`, 'utf8')
  log(`wrote ${WIKIDATA_PROTECTED_AREAS_RELATIVE_PATH}`)
}

if (import.meta.main) {
  void main().catch((error) => {
    // A Wikidata problem must not fail the nightly run: compare then runs without the block.
    console.error(`[wikidata] failed: ${String(error)}`)
  })
}
