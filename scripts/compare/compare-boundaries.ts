#!/usr/bin/env bun
import { randomUUID } from 'node:crypto'
import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { areaConfigPathForDisplay, loadAreaConfig } from '../shared/areaConfig.ts'
import { DATASETS_DIRECTORY, datasetFolderPath } from '../shared/datasetPaths.ts'
import { parseOgcInspectSourcesFromConfig } from '../shared/ogcInspectSources.ts'
import { runtimeRootFromWorkspace } from '../shared/runtimeRoot.ts'
import { readAreaSourceMetadataFile, toComparisonSourceMetadata } from '../shared/sourceMetadata.ts'
import { workspaceRootFromHere } from '../shared/workspaceRoot.ts'
import { type ComparePhaseLogger, runCompare } from './lib/compare.ts'
import { type OverpassBoundaryTag, writeOutputs } from './lib/writeOutputs.ts'

function parseArgs(argv: string[]) {
  let area: string | null = null
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--area') {
      const v = argv[i + 1]
      if (v !== undefined) {
        area = v
        i++
      }
    }
  }
  return { area }
}

function getWorkspaceRoot(): string {
  return workspaceRootFromHere(import.meta.url)
}

function overpassBoundaryTagFromMatchProperty(matchProperty: string): OverpassBoundaryTag {
  return matchProperty.trim().toLowerCase() === 'postal_code' ? 'postal_code' : 'administrative'
}

function nowIso(): string {
  return new Date().toISOString()
}

function createInternalPhaseLogger(
  runtimeRoot: string,
  area: string,
): {
  runId: string
  phaseLogger: ComparePhaseLogger
  logRunStart: () => void
  logRunEnd: (status: 'ok' | 'fail') => void
} {
  const runId = `${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}-${randomUUID().slice(0, 8)}`
  const internalLogPath = join(runtimeRoot, 'data', 'internal-compare-timing.jsonl')
  mkdirSync(join(runtimeRoot, 'data'), { recursive: true })
  const append = (event: Record<string, unknown>) => {
    appendFileSync(
      internalLogPath,
      `${JSON.stringify({ ...event, runId, area, at: nowIso() })}\n`,
      'utf-8',
    )
  }
  return {
    runId,
    phaseLogger: (phase, durationMs, meta) =>
      append({
        kind: 'compare_phase',
        phase,
        durationMs,
        ...(meta ?? {}),
      }),
    logRunStart: () => append({ kind: 'compare_run_start' }),
    logRunEnd: (status) => append({ kind: 'compare_run_end', status }),
  }
}

async function main() {
  const { area } = parseArgs(process.argv.slice(2))
  if (!area) {
    console.error('Usage: bun scripts/compare/compare-boundaries.ts --area <folder>')
    process.exit(1)
  }

  const workspaceRoot = getWorkspaceRoot()
  const runtimeRoot = runtimeRootFromWorkspace(workspaceRoot)
  let configRaw: unknown
  try {
    configRaw = loadAreaConfig(workspaceRoot, area)
  } catch (e) {
    console.error(String(e))
    console.error(`Expected ${areaConfigPathForDisplay(workspaceRoot, area)}`)
    process.exit(1)
  }

  console.log(`Comparing area: ${area}`)
  const { runId, phaseLogger, logRunStart, logRunEnd } = createInternalPhaseLogger(
    runtimeRoot,
    area,
  )
  logRunStart()
  console.log(`[compare] timing runId=${runId}`)
  const areaPath = datasetFolderPath(runtimeRoot, area)
  try {
    const { config, rows, unmatchedOsm, metricsCrs } = await runCompare(
      runtimeRoot,
      area,
      configRaw,
      phaseLogger,
    )
    const meta = toComparisonSourceMetadata(readAreaSourceMetadataFile(areaPath))
    const ogcInspectSources = parseOgcInspectSourcesFromConfig(configRaw)
    const overpassBoundaryTag = overpassBoundaryTagFromMatchProperty(config.osm.matchProperty)
    writeOutputs(
      areaPath,
      area,
      rows,
      unmatchedOsm,
      metricsCrs,
      overpassBoundaryTag,
      meta,
      ogcInspectSources,
      config.output.perFeatureJson,
      phaseLogger,
    )
    console.log(`Wrote output PMTiles + static report payloads under ${DATASETS_DIRECTORY}/${area}`)
    logRunEnd('ok')
  } catch (error) {
    logRunEnd('fail')
    throw error
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
