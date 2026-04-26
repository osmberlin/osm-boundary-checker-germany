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

async function runStep(
  runId: string,
  logPath: string,
  statePath: string,
  state: ProcessingState,
  step: string,
  command: string,
  args: string[],
  cwd: string,
  extraEnv?: Record<string, string>,
): Promise<number> {
  const t0 = Date.now()
  console.log(`[pipeline] starting ${step}`)
  appendJsonl(logPath, { kind: 'step_start', runId, at: nowIso(), step })
  writeState(statePath, { ...state, phase: step, updatedAt: nowIso() })
  const exitCode = await runCommand(command, args, cwd, step, extraEnv)
  const status: StepStatus = exitCode === 0 ? 'ok' : 'fail'
  const durationMs = Date.now() - t0
  appendJsonl(logPath, {
    kind: 'step_end',
    runId,
    at: nowIso(),
    step,
    status,
    durationMs,
    exitCode,
  })
  console.log(
    `[pipeline] ${status === 'ok' ? 'finished' : 'failed'} ${step} in ${formatDuration(durationMs)} (exit ${exitCode})`,
  )
  return exitCode
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
  const runT0 = Date.now()
  console.log(`[pipeline] run ${runId} started (${timezone})`)

  let failed = false
  const fail = () => {
    failed = true
  }
  let exitCode = 0

  try {
    const downloadSteps: Array<{ step: string; args: string[] }> = [
      { step: 'download:bkg', args: ['run', 'bkg:download'] },
      { step: 'download:official', args: ['run', 'download:official'] },
      { step: 'download:osm', args: ['run', 'osm:download'] },
    ]

    const extractSteps: Array<{ step: string; args: string[] }> = [
      { step: 'extract:bkg', args: ['run', 'bkg:extract'] },
      { step: 'extract:osm', args: ['run', 'osm:extract'] },
      // `brandenburg-berlin-plz` uses `.cache/osm/germany-postal-code-boundaries.fgb` from the same filtered PBF.
      { step: 'extract:osm:plz', args: ['run', 'osm:extract', '--', '--kind', 'plz'] },
    ]

    const runPhaseSteps = async (phaseSteps: Array<{ step: string; args: string[] }>) => {
      for (const phaseStep of phaseSteps) {
        if (failed) break
        if (
          (await runStep(
            runId,
            logPath,
            statePath,
            state,
            phaseStep.step,
            'bun',
            phaseStep.args,
            workspaceRoot,
          )) !== 0
        ) {
          fail()
        }
      }
    }

    if (phase === 'all' || phase === 'download') {
      await runPhaseSteps(downloadSteps)
    }

    if (!failed && (phase === 'all' || phase === 'extract')) {
      await runPhaseSteps(extractSteps)
    }

    if (!failed && (phase === 'all' || phase === 'compare')) {
      const areas = discoverAreas(workspaceRoot)
      if (areas.length === 0) {
        console.error(`No configured datasets found under ${DATASETS_DIRECTORY}/`)
        fail()
      }

      for (const area of areas) {
        if (failed) break
        const t0 = Date.now()
        const stepName = `compare:${area}`
        console.log(`[pipeline] starting ${stepName}`)
        appendJsonl(logPath, { kind: 'dataset_start', runId, at: nowIso(), dataset: area })
        writeState(statePath, { ...state, phase: stepName, updatedAt: nowIso() })
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
        if (exitCode !== 0) fail()
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
