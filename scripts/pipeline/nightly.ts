#!/usr/bin/env bun
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { areaHasCompareConfig } from '../shared/areaConfig.ts'
import { DATASETS_DIRECTORY } from '../shared/datasetPaths.ts'
import {
  readCompareGeneratedAt,
  resolveFallbackRuntimeRoot,
  restoreCompareOutputFromFallback,
  restoreOfficialSourceFromFallback,
  restoreOsmCacheFromFallback,
} from '../shared/lazyFallback.ts'
import {
  finalizeRunStatus,
  initRunStatus,
  type RunBranchStatus,
  upsertAreaCompareStatus,
  upsertAreaOfficialDownloadStatus,
  upsertSharedBranchStatus,
} from '../shared/runStatus.ts'
import { runtimeRootFromWorkspace } from '../shared/runtimeRoot.ts'
import { workspaceRootFromHere } from '../shared/workspaceRoot.ts'

type StepStatus = 'ok' | 'fail' | 'skipped'

type LogEvent =
  | {
      kind: 'run_start'
      runId: string
      at: string
      timezone: string
    }
  | {
      kind: 'run_end'
      runId: string
      at: string
      status: Exclude<StepStatus, 'skipped'>
      durationMs: number
    }
  | {
      kind: 'step_start'
      runId: string
      at: string
      step: string
    }
  | {
      kind: 'step_end'
      runId: string
      at: string
      step: string
      status: StepStatus
      durationMs?: number
      exitCode?: number
      reason?: string
    }
  | {
      kind: 'dataset_start'
      runId: string
      at: string
      dataset: string
    }
  | {
      kind: 'dataset_end'
      runId: string
      at: string
      dataset: string
      status: Exclude<StepStatus, 'skipped'>
      durationMs: number
      exitCode: number
    }

type ProcessingState = {
  runId: string
  startedAt: string
  timezone: string
  inProgress: boolean
  phase: string
  updatedAt: string
  completedAt?: string
  status?: 'ok' | 'fail'
}

type PipelinePhase = 'all' | 'download' | 'extract' | 'compare'
type PipelineStepName =
  | 'download:bkg'
  | 'download:official'
  | 'download:osm'
  | 'extract:bkg'
  | 'extract:osm'
  | 'extract:osm:plz'
type PipelineStep = { step: PipelineStepName; args: string[] }

function nowIso(): string {
  return new Date().toISOString()
}

function formatDuration(durationMs: number): string {
  if (durationMs < 1000) return `${durationMs}ms`
  if (durationMs < 60_000) return `${(durationMs / 1000).toFixed(1)}s`
  const minutes = Math.floor(durationMs / 60_000)
  const seconds = ((durationMs % 60_000) / 1000).toFixed(1)
  return `${minutes}m ${seconds}s`
}

function appendJsonl(path: string, event: LogEvent): void {
  appendFileSync(path, `${JSON.stringify(event)}\n`, 'utf-8')
}

function writeState(path: string, state: ProcessingState): void {
  writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`, 'utf-8')
}

function discoverAreas(workspaceRoot: string): string[] {
  const datasetsRoot = join(workspaceRoot, DATASETS_DIRECTORY)
  if (!existsSync(datasetsRoot)) return []
  const out: string[] = []
  for (const entry of readdirSync(datasetsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    if (entry.name.startsWith('.')) continue
    if (areaHasCompareConfig(workspaceRoot, entry.name)) out.push(entry.name)
  }
  return out.sort()
}

async function runCommand(
  command: string,
  args: string[],
  cwd: string,
  step: string,
  extraEnv?: Record<string, string>,
): Promise<number> {
  return await new Promise<number>((resolve) => {
    const startedAt = Date.now()
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      env: {
        ...process.env,
        ...extraEnv,
      },
    })
    // Keep long-running CI steps chatty so they are easier to debug and less likely to look stuck.
    const heartbeat = setInterval(() => {
      const elapsed = formatDuration(Date.now() - startedAt)
      console.log(`[pipeline] ${step} still running (${elapsed})`)
    }, 60_000)

    child.on('close', (code, signal) => {
      clearInterval(heartbeat)
      if (signal) {
        console.warn(`[pipeline] ${step} terminated by signal ${signal}`)
      }
      resolve(code ?? 1)
    })
    child.on('error', () => {
      clearInterval(heartbeat)
      resolve(1)
    })
  })
}

function branchStatusFromStepResult(
  status: StepStatus,
  usedCache: boolean,
  step: string,
): RunBranchStatus {
  if (status === 'ok') return 'success'
  if (status === 'skipped' && usedCache) return 'success'
  if (step.startsWith('compare:')) return 'compare_failed'
  return 'failed_no_cache'
}

function parseArgs(argv: string[]): { phase: PipelinePhase } {
  let phase: PipelinePhase | null = null
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] !== '--phase') continue
    const value = argv[i + 1]?.trim().toLowerCase()
    if (value === 'all' || value === 'download' || value === 'extract' || value === 'compare') {
      phase = value
      i++
      continue
    }
    throw new Error(
      `Invalid --phase value "${argv[i + 1] ?? ''}". Expected all|download|extract|compare.`,
    )
  }
  if (phase == null) {
    throw new Error(
      'Missing required --phase argument. Expected one of: all|download|extract|compare.',
    )
  }
  return { phase }
}

async function main() {
  const { phase } = parseArgs(process.argv.slice(2))
  const workspaceRoot = workspaceRootFromHere(import.meta.url)
  const runtimeRoot = runtimeRootFromWorkspace(workspaceRoot)
  const processingDir = join(runtimeRoot, 'data')
  const logPath = join(processingDir, 'processing-log.jsonl')
  const statePath = join(processingDir, 'processing-state.json')
  const lockPath = join(processingDir, 'processing.lock')
  const timezone =
    process.env.PIPELINE_TIMEZONE?.trim() || process.env.TZ?.trim() || 'Europe/Berlin'
  const runId = `${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}-${randomUUID().slice(0, 8)}`
  const fallbackRuntimeRoot = resolveFallbackRuntimeRoot(workspaceRoot)

  mkdirSync(processingDir, { recursive: true })
  let lockFd = -1
  try {
    lockFd = openSync(lockPath, 'wx')
    writeFileSync(lockFd, `${runId}\n`, 'utf-8')
  } catch {
    console.error(`Pipeline lock exists: ${lockPath}`)
    process.exit(2)
  }

  const startedAt = nowIso()
  const state: ProcessingState = {
    runId,
    startedAt,
    timezone,
    inProgress: true,
    phase: `starting:${phase}`,
    updatedAt: startedAt,
  }
  writeState(statePath, state)
  appendJsonl(logPath, { kind: 'run_start', runId, at: startedAt, timezone })
  initRunStatus(processingDir, runId, startedAt)
  const runT0 = Date.now()
  console.log(`[pipeline] run ${runId} started (${timezone})`)

  let failed = false
  let exitCode = 0
  let skipExtractBkg = false
  let skipExtractOsmAdmin = false
  let skipExtractOsmPlz = false

  try {
    const downloadSteps: PipelineStep[] = [
      { step: 'download:bkg', args: ['run', 'bkg:download'] },
      { step: 'download:official', args: ['run', 'download:official'] },
      { step: 'download:osm', args: ['run', 'osm:download'] },
    ]

    const extractSteps: PipelineStep[] = [
      { step: 'extract:bkg', args: ['run', 'bkg:extract'] },
      { step: 'extract:osm', args: ['run', 'osm:extract'] },
      // `brandenburg-berlin-plz` uses `.cache/osm/germany-postal-code-boundaries.fgb` from the same filtered PBF.
      { step: 'extract:osm:plz', args: ['run', 'osm:extract', '--', '--kind', 'plz'] },
    ]

    const runPhaseSteps = async (phaseSteps: PipelineStep[]) => {
      for (const phaseStep of phaseSteps) {
        const t0 = Date.now()
        console.log(`[pipeline] starting ${phaseStep.step}`)
        appendJsonl(logPath, { kind: 'step_start', runId, at: nowIso(), step: phaseStep.step })
        writeState(statePath, { ...state, phase: phaseStep.step, updatedAt: nowIso() })

        let stepStatus: StepStatus = 'ok'
        let usedCache = false
        let reason: string | undefined
        const shouldSkipFromFallback =
          (phaseStep.step === 'extract:bkg' && skipExtractBkg) ||
          (phaseStep.step === 'extract:osm' && skipExtractOsmAdmin) ||
          (phaseStep.step === 'extract:osm:plz' && skipExtractOsmPlz)
        let commandExitCode = 0
        if (shouldSkipFromFallback) {
          stepStatus = 'skipped'
          usedCache = true
          reason = 'fallback_inputs_already_restored'
        } else {
          commandExitCode = await runCommand('bun', phaseStep.args, workspaceRoot, phaseStep.step)
        }
        let finalExitCode = commandExitCode
        if (commandExitCode !== 0 && !shouldSkipFromFallback) {
          if (!fallbackRuntimeRoot) {
            stepStatus = 'fail'
          } else {
            switch (phaseStep.step) {
              case 'download:bkg': {
                // For compare continuation we only need per-area official sources, not raw BKG archives.
                const areas = discoverAreas(workspaceRoot)
                let restoredAny = false
                for (const area of areas) {
                  const restored = restoreOfficialSourceFromFallback(
                    runtimeRoot,
                    fallbackRuntimeRoot,
                    area,
                  )
                  if (restored) {
                    restoredAny = true
                    upsertAreaOfficialDownloadStatus(processingDir, area, {
                      status: 'success',
                      usedCache: true,
                      retryHint: 'automatic retry next nightly run',
                    })
                  }
                }
                if (restoredAny) {
                  stepStatus = 'skipped'
                  usedCache = true
                  reason = 'fallback_official_source_restored_after_bkg_download_failure'
                  finalExitCode = 0
                  skipExtractBkg = true
                } else {
                  stepStatus = 'fail'
                }
                break
              }
              case 'download:osm': {
                const restored = restoreOsmCacheFromFallback(runtimeRoot, fallbackRuntimeRoot)
                if (restored) {
                  stepStatus = 'skipped'
                  usedCache = true
                  reason = 'fallback_osm_cache_restored'
                  finalExitCode = 0
                  skipExtractOsmAdmin = true
                  skipExtractOsmPlz = true
                } else {
                  stepStatus = 'fail'
                }
                break
              }
              case 'download:official': {
                const areas = discoverAreas(workspaceRoot)
                let restoredAny = false
                for (const area of areas) {
                  const restored = restoreOfficialSourceFromFallback(
                    runtimeRoot,
                    fallbackRuntimeRoot,
                    area,
                  )
                  if (restored) {
                    restoredAny = true
                    upsertAreaOfficialDownloadStatus(processingDir, area, {
                      status: 'success',
                      usedCache: true,
                      retryHint: 'automatic retry next nightly run',
                    })
                  }
                }
                if (restoredAny) {
                  stepStatus = 'skipped'
                  usedCache = true
                  reason = 'fallback_official_source_restored'
                  finalExitCode = 0
                  skipExtractBkg = true
                } else {
                  stepStatus = 'fail'
                }
                break
              }
              case 'extract:bkg':
              case 'extract:osm':
              case 'extract:osm:plz':
                stepStatus = 'fail'
                break
            }
          }
        }

        const durationMs = Date.now() - t0
        appendJsonl(logPath, {
          kind: 'step_end',
          runId,
          at: nowIso(),
          step: phaseStep.step,
          status: stepStatus,
          durationMs,
          exitCode: finalExitCode,
          reason,
        })
        console.log(
          `[pipeline] ${stepStatus === 'ok' ? 'finished' : stepStatus === 'skipped' ? 'reused cache for' : 'failed'} ${phaseStep.step} in ${formatDuration(durationMs)} (exit ${finalExitCode})`,
        )

        const branchStatus = branchStatusFromStepResult(stepStatus, usedCache, phaseStep.step)
        upsertSharedBranchStatus(processingDir, phaseStep.step, {
          status: branchStatus,
          usedCache,
          retryHint:
            branchStatus === 'failed_no_cache' ? 'automatic retry next nightly run' : undefined,
          errorCode: finalExitCode === 0 ? undefined : String(finalExitCode),
        })
        if (finalExitCode !== 0) failed = true
      }
    }

    if (phase === 'all' || phase === 'download') {
      await runPhaseSteps(downloadSteps)
    }

    if (phase === 'all' || phase === 'extract') {
      await runPhaseSteps(extractSteps)
    }

    if (phase === 'all' || phase === 'compare') {
      const areas = discoverAreas(workspaceRoot)
      if (areas.length === 0) {
        console.error(`No configured datasets found under ${DATASETS_DIRECTORY}/`)
        failed = true
        upsertSharedBranchStatus(processingDir, 'compare:discover', {
          status: 'failed_no_cache',
          usedCache: false,
          errorMessage: `No configured datasets found under ${DATASETS_DIRECTORY}/`,
          retryHint: 'automatic retry next nightly run',
        })
      }

      for (const area of areas) {
        const t0 = Date.now()
        const stepName = `compare:${area}`
        console.log(`[pipeline] starting ${stepName}`)
        appendJsonl(logPath, { kind: 'dataset_start', runId, at: nowIso(), dataset: area })
        writeState(statePath, { ...state, phase: stepName, updatedAt: nowIso() })
        const hadCompareOutputBefore = readCompareGeneratedAt(runtimeRoot, area) != null
        const exitCode = await runCommand(
          'bun',
          ['run', 'compare:boundaries', '--', '--area', area],
          workspaceRoot,
          stepName,
          { CI: '1' },
        )
        const durationMs = Date.now() - t0
        appendJsonl(logPath, {
          kind: 'dataset_end',
          runId,
          at: nowIso(),
          dataset: area,
          status: exitCode === 0 ? 'ok' : 'fail',
          durationMs,
          exitCode,
        })
        console.log(
          `[pipeline] ${exitCode === 0 ? 'finished' : 'failed'} ${stepName} in ${formatDuration(durationMs)} (exit ${exitCode})`,
        )
        if (exitCode === 0) {
          upsertAreaCompareStatus(processingDir, area, {
            status: 'success',
            usedCache: false,
            compareOutputOrigin: 'current_run',
            compareOutputGeneratedAt: readCompareGeneratedAt(runtimeRoot, area) ?? undefined,
          })
          continue
        }

        let usedCache = false
        let compareOutputOrigin: 'cache_last_good' | 'none' = 'none'
        if (fallbackRuntimeRoot) {
          const restored = restoreCompareOutputFromFallback(runtimeRoot, fallbackRuntimeRoot, area)
          if (restored) {
            usedCache = true
            compareOutputOrigin = 'cache_last_good'
          }
        }
        if (!usedCache && hadCompareOutputBefore) {
          usedCache = true
          compareOutputOrigin = 'cache_last_good'
        }

        upsertAreaCompareStatus(processingDir, area, {
          status: 'compare_failed',
          usedCache,
          compareOutputOrigin,
          compareOutputGeneratedAt: readCompareGeneratedAt(runtimeRoot, area) ?? undefined,
          errorCode: String(exitCode),
          retryHint: 'automatic retry next nightly run',
        })
        failed = true
      }
    }

    const finalStatus = failed ? 'fail' : 'ok'
    const finishedAt = nowIso()
    const runDurationMs = Date.now() - runT0
    appendJsonl(logPath, {
      kind: 'run_end',
      runId,
      at: finishedAt,
      status: finalStatus,
      durationMs: runDurationMs,
    })
    console.log(
      `[pipeline] run ${runId} ${finalStatus === 'ok' ? 'finished' : 'failed'} in ${formatDuration(runDurationMs)}`,
    )
    writeState(statePath, {
      ...state,
      inProgress: false,
      phase: 'finished',
      updatedAt: finishedAt,
      completedAt: finishedAt,
      status: finalStatus,
    })
    finalizeRunStatus(processingDir, {
      runId,
      startedAt,
      status: finalStatus,
      updatedAt: finishedAt,
    })

    exitCode = failed ? 1 : 0
  } finally {
    try {
      if (lockFd >= 0) rmSync(lockPath, { force: true })
    } catch {
      // ignore cleanup errors
    }
  }

  process.exit(exitCode)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
