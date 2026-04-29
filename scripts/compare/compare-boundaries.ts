#!/usr/bin/env bun
import { randomUUID } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { areaConfigPathForDisplay, loadAreaConfig } from '../shared/areaConfig.ts'
import { parseAreaDisplayName } from '../shared/areaConfigMetadata.ts'
import {
  comparisonForReportSchema,
  type ComparisonFilterConfigSummary,
  type ReportMetrics,
} from '../shared/comparisonPayload.ts'
import type { DatasetConfig } from '../shared/datasetConfig.ts'
import { DATASETS_DIRECTORY, datasetFolderPath } from '../shared/datasetPaths.ts'
import { parseOgcInspectSourcesFromConfig } from '../shared/ogcInspectSources.ts'
import { runtimeRootFromWorkspace } from '../shared/runtimeRoot.ts'
import { requireComparisonSourceMetadata } from '../shared/sourceMetadata.ts'
import { readAreaSourceMetadataFile } from '../shared/sourceMetadataIo.ts'
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

function toFilterConfigSummary(configRaw: DatasetConfig): ComparisonFilterConfigSummary {
  return {
    officialMatchProperty: configRaw.compare.officialMatchProperty,
    bboxFilter: configRaw.compare.bboxFilter,
    ...(configRaw.compare.bboxBufferDegrees !== undefined
      ? { bboxBufferDegrees: configRaw.compare.bboxBufferDegrees }
      : {}),
    osmScopeFilter: configRaw.compare.osmScopeFilter,
    ...(configRaw.osm?.adminLevels?.length ? { adminLevels: [...configRaw.osm.adminLevels] } : {}),
    ...(configRaw.osm?.ignoreRelationIds?.length
      ? { ignoreRelationIds: [...configRaw.osm.ignoreRelationIds] }
      : {}),
    ...(configRaw.officialMode === 'direct' && configRaw.official.extractLayer?.trim()
      ? { officialExtractLayer: configRaw.official.extractLayer.trim() }
      : {}),
  }
}

function loadPreviousMetricsByKey(areaPath: string): Map<string, ReportMetrics> {
  const tablePath = join(areaPath, 'output', 'comparison_table.json')
  if (!existsSync(tablePath)) return new Map()
  try {
    const raw = JSON.parse(readFileSync(tablePath, 'utf-8')) as unknown
    const parsed = comparisonForReportSchema.safeParse(raw)
    if (!parsed.success) return new Map()
    const out = new Map<string, ReportMetrics>()
    for (const row of parsed.data.rows) {
      if (!row.metrics) continue
      out.set(row.canonicalMatchKey, row.metrics)
    }
    return out
  } catch {
    return new Map()
  }
}

function createInternalPhaseLogger(
  runtimeRoot: string,
  area: string,
): {
  runId: string
  phaseLogger: ComparePhaseLogger
  checkpointLogger: (checkpoint: string, meta?: Record<string, unknown>) => void
  progressLogger: (
    scope: string,
    current: number,
    total: number,
    meta?: Record<string, unknown>,
  ) => void
  appendEvent: (event: Record<string, unknown>) => void
  logRunStart: () => void
  logRunEnd: (status: 'ok' | 'fail', meta?: Record<string, unknown>) => void
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
    appendEvent: append,
    phaseLogger: (phase, durationMs, meta) =>
      append({
        kind: 'compare_phase',
        phase,
        durationMs,
        ...meta,
      }),
    checkpointLogger: (checkpoint, meta) =>
      append({ kind: 'compare_checkpoint', checkpoint, ...meta }),
    progressLogger: (scope, current, total, meta) =>
      append({ kind: 'compare_progress', scope, current, total, ...meta }),
    logRunStart: () => append({ kind: 'compare_run_start' }),
    logRunEnd: (status, meta) => append({ kind: 'compare_run_end', status, ...meta }),
  }
}

function signalExitCode(signal: 'SIGINT' | 'SIGTERM'): number {
  switch (signal) {
    case 'SIGINT':
      return 130
    case 'SIGTERM':
      return 143
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
  let configRaw: DatasetConfig
  try {
    configRaw = loadAreaConfig(workspaceRoot, area)
  } catch (e) {
    console.error(String(e))
    console.error(`Expected ${areaConfigPathForDisplay(workspaceRoot, area)}`)
    process.exit(1)
  }

  console.log(`Comparing area: ${area}`)
  const {
    runId,
    phaseLogger,
    checkpointLogger,
    progressLogger,
    appendEvent,
    logRunStart,
    logRunEnd,
  } = createInternalPhaseLogger(runtimeRoot, area)
  const runStartedEpoch = Date.now()
  let lastCheckpoint = 'run_start'
  let inFlightPhase: string | null = null
  let finalized = false

  const checkpoint = (name: string, meta?: Record<string, unknown>) => {
    lastCheckpoint = name
    checkpointLogger(name, meta)
  }
  const finalizeRun = (status: 'ok' | 'fail', meta?: Record<string, unknown>) => {
    if (finalized) return
    finalized = true
    logRunEnd(status, meta)
  }
  const onSignal = (signal: 'SIGINT' | 'SIGTERM') => {
    appendEvent({
      kind: 'compare_signal',
      signal,
      lastCheckpoint,
      inFlightPhase,
      elapsedMs: Date.now() - runStartedEpoch,
    })
    finalizeRun('fail', {
      reason: 'signal',
      signal,
      lastCheckpoint,
      inFlightPhase,
      elapsedMs: Date.now() - runStartedEpoch,
    })
    process.exit(signalExitCode(signal))
  }

  process.once('SIGTERM', onSignal)
  process.once('SIGINT', onSignal)
  logRunStart()
  checkpoint('run_start')
  console.log(`[compare] timing runId=${runId}`)
  const areaPath = datasetFolderPath(runtimeRoot, area)
  const previousMetricsByKey = loadPreviousMetricsByKey(areaPath)
  const skipIssueIndicator = area === 'de-gemeinden'
  if (skipIssueIndicator) {
    console.log(
      `[compare] skipping issue-indicator enrichment for ${area} (isolated from parallel de-gemeinden split work)`,
    )
  }
  try {
    checkpoint('before_run_compare')
    const { config, rows, unmatchedOsm, metricsCrs } = await runCompare(
      runtimeRoot,
      area,
      configRaw,
      phaseLogger,
      {
        checkpoint: (name, meta) => checkpoint(name, meta),
        progress: (scope, current, total, meta) =>
          progressLogger(scope, current, total, {
            elapsedMs: Date.now() - runStartedEpoch,
            ...meta,
          }),
        setInFlightPhase: (phase) => {
          inFlightPhase = phase
        },
      },
      {
        previousMetricsByKey,
        skipIssueIndicator,
      },
    )
    checkpoint('after_run_compare', { rows: rows.length, unmatched: unmatchedOsm.length })
    const meta = requireComparisonSourceMetadata(readAreaSourceMetadataFile(areaPath))
    const filterConfigSummary = toFilterConfigSummary(configRaw)
    const ogcInspectSources = parseOgcInspectSourcesFromConfig(configRaw)
    const overpassBoundaryTag = overpassBoundaryTagFromMatchProperty(config.osm.matchProperty)
    const displayName = parseAreaDisplayName(area, configRaw)
    writeOutputs(
      areaPath,
      area,
      displayName,
      config.titlePrefix,
      rows,
      unmatchedOsm,
      metricsCrs,
      overpassBoundaryTag,
      meta,
      filterConfigSummary,
      ogcInspectSources,
      phaseLogger,
      {
        checkpoint: (name, cpMeta) => checkpoint(name, cpMeta),
        progress: (scope, current, total, pMeta) =>
          progressLogger(scope, current, total, {
            elapsedMs: Date.now() - runStartedEpoch,
            ...pMeta,
          }),
        setInFlightPhase: (phase) => {
          inFlightPhase = phase
        },
      },
    )
    checkpoint('after_write_outputs')
    console.log(`Wrote output PMTiles + static report payloads under ${DATASETS_DIRECTORY}/${area}`)
    finalizeRun('ok', { elapsedMs: Date.now() - runStartedEpoch })
  } catch (error) {
    checkpoint('compare_failed', { detail: String(error) })
    finalizeRun('fail', {
      elapsedMs: Date.now() - runStartedEpoch,
      lastCheckpoint,
      inFlightPhase,
      detail: String(error),
    })
    throw error
  } finally {
    process.removeListener('SIGTERM', onSignal)
    process.removeListener('SIGINT', onSignal)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
