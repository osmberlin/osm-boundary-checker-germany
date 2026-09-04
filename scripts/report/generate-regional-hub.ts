#!/usr/bin/env bun
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadFeatureCollection } from '../compare/lib/loadFeatureCollection.ts'
import { sumGemeindeAttributesForPrefix } from '../shared/germanKeyGemeindeSum.ts'
import {
  germanKeyLookupBundleSchema,
  type GermanKeyLookupBundle,
} from '../shared/germanKeyLookupPayload.ts'
import { padRegional12 } from '../shared/regionalArs.ts'
import { parsePopulationNumber, primaryRegionalHubIssue } from '../shared/regionalHubCompare.ts'
import {
  regionalHubManifestSchema,
  regionalHubMismatchFlagsFileSchema,
  regionalHubOsmTagsFileSchema,
  regionalHubWikidataFileSchema,
  type RegionalHubManifest,
  type RegionalHubMismatchFlagsFile,
  type RegionalHubOsmTagsFile,
  type RegionalHubWikidataFile,
} from '../shared/regionalHubPayload.ts'
import { runtimeRootFromWorkspace } from '../shared/runtimeRoot.ts'
import { workspaceRootFromHere } from '../shared/workspaceRoot.ts'
import { sharedAdminFgbPath } from './emitRegionalOsmTags.ts'
import { fetchWikidataRegionalDump } from './fetchWikidataRegional.ts'
import { collectRegionalOsmTags } from './regionalOsmTags.ts'

const LOOKUP_REL = 'report/public/data/german-key-lookup.json'
const HUB_PUBLIC_REL = 'report/public/data/regional-hub'
const HUB_RUNTIME_REL = 'data/regional-hub'

function parseArgs(argv: string[]) {
  return { force: argv.includes('--force') }
}

function logLine(
  message: string,
  meta: Record<string, string | number | boolean | undefined> = {},
) {
  const suffix = Object.entries(meta)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${key}=${value}`)
    .join(' ')
  console.log(suffix ? `[regional-hub] ${message} ${suffix}` : `[regional-hub] ${message}`)
}

function readJsonIfExists(path: string): unknown | null {
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as unknown
  } catch (error) {
    logLine('existing JSON unreadable', { path, detail: String(error) })
    return null
  }
}

function writeNamed(dirs: string[], basename: string, payload: unknown): void {
  const text = `${JSON.stringify(payload)}\n`
  for (const dir of dirs) {
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, basename), text, 'utf8')
  }
}

function destatisPopForArs(
  bundle: GermanKeyLookupBundle,
  ars12: string,
): { populationTotal?: number; areaKm2?: number } {
  const attrs = bundle.latest.gemeindeAttributesByArs ?? {}
  const direct = attrs[ars12]
  if (direct?.populationTotal !== undefined || direct?.areaKm2 !== undefined) return direct
  if (ars12.endsWith('0000000000')) {
    return sumGemeindeAttributesForPrefix(attrs, ars12.slice(0, 2)) ?? {}
  }
  if (ars12.endsWith('0000000')) {
    return sumGemeindeAttributesForPrefix(attrs, ars12.slice(0, 5)) ?? {}
  }
  if (ars12.endsWith('000')) {
    return sumGemeindeAttributesForPrefix(attrs, ars12.slice(0, 9)) ?? {}
  }
  return {}
}

function collectHubArsKeys(
  bundle: GermanKeyLookupBundle,
  osm: RegionalHubOsmTagsFile,
  wikidata: RegionalHubWikidataFile,
): string[] {
  const keys = new Set<string>()
  for (const ars of Object.keys(bundle.latest.gemeindenByArs)) keys.add(ars)
  for (const land of Object.keys(bundle.latest.bundeslaender)) {
    const padded = padRegional12(land)
    if (padded) keys.add(padded)
  }
  for (const kreis of Object.keys(bundle.latest.kreise)) {
    const padded = padRegional12(kreis)
    if (padded) keys.add(padded)
  }
  for (const ars of Object.keys(osm.byArs)) keys.add(ars)
  for (const ars of Object.keys(wikidata.byArs)) keys.add(ars)
  return [...keys].sort((a, b) => a.localeCompare(b, 'de', { numeric: true }))
}

function buildMismatchFlags(
  bundle: GermanKeyLookupBundle,
  osm: RegionalHubOsmTagsFile,
  wikidata: RegionalHubWikidataFile,
  generatedAt: string,
): RegionalHubMismatchFlagsFile {
  const destatisDate = bundle.latest.populationDate
  const byArs: RegionalHubMismatchFlagsFile['byArs'] = {}
  for (const ars of collectHubArsKeys(bundle, osm, wikidata)) {
    const destatis = destatisPopForArs(bundle, ars)
    const osmTag = osm.byArs[ars]
    const wd = wikidata.byArs[ars]
    const flag = primaryRegionalHubIssue({
      destatisPop: destatis.populationTotal,
      destatisDate,
      osmPop: parsePopulationNumber(osmTag?.population),
      osmDate: osmTag?.populationDate,
      osmWikidata: osmTag?.wikidata,
      osmId: osmTag?.osmId,
      wdQid: wd?.qid,
      wdPop: wd?.pop,
      wdDate: wd?.date,
      wdOsmRelationId: wd?.osmRelationId,
    })
    if (flag) byArs[ars] = flag
  }
  return regionalHubMismatchFlagsFileSchema.parse({ generatedAt, byArs })
}

async function loadOsmTags(
  runtimeRoot: string,
  existing: RegionalHubOsmTagsFile | null,
): Promise<RegionalHubOsmTagsFile> {
  const fgbPath = sharedAdminFgbPath(runtimeRoot)
  if (!existsSync(fgbPath)) {
    if (existing) {
      logLine('OSM FGB missing; keeping last-good tags', { path: fgbPath })
      return { ...existing, generatedAt: existing.generatedAt }
    }
    return regionalHubOsmTagsFileSchema.parse({
      generatedAt: new Date().toISOString(),
      featureCount: 0,
      byArs: {},
    })
  }
  logLine('reading OSM admin FGB', { path: fgbPath })
  const collection = await loadFeatureCollection(fgbPath)
  return collectRegionalOsmTags(collection)
}

function loadLookup(workspaceRoot: string): GermanKeyLookupBundle {
  const path = join(workspaceRoot, LOOKUP_REL)
  const raw = readJsonIfExists(path)
  if (!raw) {
    throw new Error(`Missing ${LOOKUP_REL}; run german-key-lookup:update first`)
  }
  return germanKeyLookupBundleSchema.parse(raw)
}

async function main(): Promise<void> {
  const { force } = parseArgs(process.argv.slice(2))
  const workspaceRoot = workspaceRootFromHere(import.meta.url)
  const runtimeRoot = runtimeRootFromWorkspace(workspaceRoot)
  const publicDir = join(workspaceRoot, HUB_PUBLIC_REL)
  const runtimeDir = join(runtimeRoot, HUB_RUNTIME_REL)
  const dirs = [publicDir, runtimeDir]
  const generatedAt = new Date().toISOString()

  const bundle = loadLookup(workspaceRoot)
  const existingOsm = regionalHubOsmTagsFileSchema.safeParse(
    readJsonIfExists(join(runtimeDir, 'osm-tags.json')) ??
      readJsonIfExists(join(publicDir, 'osm-tags.json')),
  )
  const existingWd = regionalHubWikidataFileSchema.safeParse(
    readJsonIfExists(join(runtimeDir, 'wikidata.json')) ??
      readJsonIfExists(join(publicDir, 'wikidata.json')),
  )

  const osm = await loadOsmTags(runtimeRoot, existingOsm.success ? existingOsm.data : null)
  logLine('OSM tags', { ars: Object.keys(osm.byArs).length, features: osm.featureCount })

  const wikidata = await fetchWikidataRegionalDump({
    existing: existingWd.success ? existingWd.data : null,
    force,
  })
  logLine('Wikidata', {
    ars: wikidata.rowCount,
    durationMs: wikidata.durationMs,
    skipped: wikidata.skipped ?? false,
    splitByLand: wikidata.splitByLand ?? false,
  })

  const mismatch = buildMismatchFlags(bundle, osm, wikidata, generatedAt)
  logLine('mismatch flags', { count: Object.keys(mismatch.byArs).length })

  const sampleArs = '120510000000'
  const sample = destatisPopForArs(bundle, sampleArs)
  const manifest: RegionalHubManifest = regionalHubManifestSchema.parse({
    generatedAt,
    destatis: {
      snapshotDate: bundle.latest.source.snapshotDate,
      populationDate: bundle.latest.populationDate,
      sourcePublicUrl: bundle.latest.sourcePublicUrl,
      downloadUrl: bundle.latest.source.downloadUrl,
      gemeindenWithPopulation: bundle.latest.destatisMerkmale?.gemeindenWithPopulation,
      areaColumnHeader: bundle.latest.destatisMerkmale?.areaColumnHeader,
      populationColumnHeader: bundle.latest.destatisMerkmale?.populationColumnHeader,
      sampleArs,
      samplePopulation: sample.populationTotal,
      sampleAreaKm2: sample.areaKm2,
    },
    osm: {
      generatedAt: osm.generatedAt,
      featureCount: osm.featureCount,
      skipReason: existsSync(sharedAdminFgbPath(runtimeRoot)) ? undefined : 'osm_fgb_missing',
    },
    wikidata: {
      generatedAt: wikidata.generatedAt,
      durationMs: wikidata.durationMs,
      rowCount: wikidata.rowCount,
      duplicateArsCount: wikidata.duplicateArsCount,
      skipReason: wikidata.skipReason,
      splitByLand: wikidata.splitByLand,
      sparqlError: wikidata.sparqlError,
    },
  })

  writeNamed(dirs, 'osm-tags.json', osm)
  writeNamed(dirs, 'wikidata.json', wikidata)
  writeNamed(dirs, 'mismatch-flags.json', mismatch)
  writeNamed(dirs, 'manifest.json', manifest)
  logLine('wrote hub files', { public: HUB_PUBLIC_REL, runtime: HUB_RUNTIME_REL })
}

void main().catch((error) => {
  console.error(`[regional-hub] failed: ${String(error)}`)
  process.exit(1)
})
