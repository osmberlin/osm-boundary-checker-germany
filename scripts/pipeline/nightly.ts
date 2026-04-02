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

function nowIso(): string {
  return new Date().toISOString()
}

function appendJsonl(path: string, event: LogEvent): void {
  appendFileSync(path, `${JSON.stringify(event)}\n`, 'utf-8')
}

function writeState(path: string, state: ProcessingState): void {
  writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`, 'utf-8')
}

function weekdayInTz(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: timezone }).format(date)
}

function isFriday(timezone: string): boolean {
  try {
    return weekdayInTz(new Date(), timezone) === 'Friday'
  } catch {
    return weekdayInTz(new Date(), 'UTC') === 'Friday'
  }
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
  extraEnv?: Record<string, string>,
): Promise<number> {
  return await new Promise<number>((resolve) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      env: {
        ...process.env,
        ...extraEnv,
      },
    })
    child.on('close', (code) => resolve(code ?? 1))
    child.on('error', () => resolve(1))
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
  appendJsonl(logPath, { kind: 'step_start', runId, at: nowIso(), step })
  writeState(statePath, { ...state, phase: step, updatedAt: nowIso() })
  const exitCode = await runCommand(command, args, cwd, extraEnv)
  const status: StepStatus = exitCode === 0 ? 'ok' : 'fail'
  appendJsonl(logPath, {
    kind: 'step_end',
    runId,
    at: nowIso(),
    step,
    status,
    durationMs: Date.now() - t0,
    exitCode,
  })
  return exitCode
}

async function main() {
  const workspaceRoot = workspaceRootFromHere(import.meta.url)
  const processingDir = join(workspaceRoot, 'data')
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
    phase: 'starting',
    updatedAt: startedAt,
  }
  writeState(statePath, state)
  appendJsonl(logPath, { kind: 'run_start', runId, at: startedAt, timezone })
  const runT0 = Date.now()

  let failed = false
  const fail = () => {
    failed = true
  }
  let exitCode = 0

  try {
    // Download + extract OSM every run.
    if (
      (await runStep(
        runId,
        logPath,
        statePath,
        state,
        'osm:download',
        'bun',
        ['run', 'osm:download'],
        workspaceRoot,
      )) !== 0
    )
      fail()
    if (
      !failed &&
      (await runStep(
        runId,
        logPath,
        statePath,
        state,
        'osm:extract',
        'bun',
        ['run', 'osm:extract'],
        workspaceRoot,
      )) !== 0
    )
      fail()

    // Refresh official reference data only on Fridays.
    if (!failed && isFriday(timezone)) {
      if (
        (await runStep(
          runId,
          logPath,
          statePath,
          state,
          'bkg:download',
          'bun',
          ['run', 'bkg:download'],
          workspaceRoot,
        )) !== 0
      )
        fail()
      if (
        !failed &&
        (await runStep(
          runId,
          logPath,
          statePath,
          state,
          'bkg:extract',
          'bun',
          ['run', 'bkg:extract'],
          workspaceRoot,
        )) !== 0
      )
        fail()
      if (
        !failed &&
        (await runStep(
          runId,
          logPath,
          statePath,
          state,
          'berlin:download',
          'bun',
          ['run', 'berlin:download'],
          workspaceRoot,
        )) !== 0
      )
        fail()
    } else {
      appendJsonl(logPath, {
        kind: 'step_end',
        runId,
        at: nowIso(),
        step: 'reference:refresh',
        status: 'skipped',
        reason: 'friday_only',
      })
    }

    const areas = discoverAreas(workspaceRoot)
    if (areas.length === 0) {
      console.error(`No configured datasets found under ${DATASETS_DIRECTORY}/`)
      fail()
    }

    for (const area of areas) {
      if (failed) break
      const t0 = Date.now()
      appendJsonl(logPath, { kind: 'dataset_start', runId, at: nowIso(), dataset: area })
      writeState(statePath, { ...state, phase: `compare:${area}`, updatedAt: nowIso() })
      const exitCode = await runCommand(
        'bun',
        ['run', 'compare:boundaries', '--', '--area', area],
        workspaceRoot,
        { CI: '1' },
      )
      appendJsonl(logPath, {
        kind: 'dataset_end',
        runId,
        at: nowIso(),
        dataset: area,
        status: exitCode === 0 ? 'ok' : 'fail',
        durationMs: Date.now() - t0,
        exitCode,
      })
      if (exitCode !== 0) fail()
    }

    const finalStatus = failed ? 'fail' : 'ok'
    const finishedAt = nowIso()
    appendJsonl(logPath, {
      kind: 'run_end',
      runId,
      at: finishedAt,
      status: finalStatus,
      durationMs: Date.now() - runT0,
    })
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
