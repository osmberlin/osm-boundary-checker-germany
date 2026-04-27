import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export type RunBranchStatus = 'success' | 'failed_no_cache' | 'compare_failed' | 'skipped'

export type CompareOutputOrigin = 'current_run' | 'cache_last_good' | 'none'

export type RunStatusBranch = {
  status: RunBranchStatus
  updatedAt: string
  usedCache?: boolean
  artifactTimestamp?: string
  errorCode?: string
  errorMessage?: string
  retryHint?: string
}

export type RunStatusCompareBranch = RunStatusBranch & {
  compareOutputOrigin?: CompareOutputOrigin
  compareOutputGeneratedAt?: string
}

export type RunStatusArea = {
  compare?: RunStatusCompareBranch
  officialDownload?: RunStatusBranch
}

export type RunStatusFile = {
  version: 1
  runId: string
  startedAt: string
  updatedAt: string
  inProgress: boolean
  status?: 'ok' | 'fail'
  shared: Record<string, RunStatusBranch>
  areas: Record<string, RunStatusArea>
}

export const RUN_STATUS_FILE = 'run-status.json'

function safeNow(): string {
  return new Date().toISOString()
}

function readRunStatusOrNull(path: string): RunStatusFile | null {
  if (!existsSync(path)) return null
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf-8')) as RunStatusFile
    if (parsed && parsed.version === 1 && typeof parsed.runId === 'string') return parsed
  } catch {
    // ignore malformed file and rebuild
  }
  return null
}

function writeAtomic(path: string, body: RunStatusFile): void {
  mkdirSync(dirname(path), { recursive: true })
  const tmpPath = `${path}.tmp`
  writeFileSync(tmpPath, `${JSON.stringify(body, null, 2)}\n`, 'utf-8')
  renameSync(tmpPath, path)
}

export function runStatusPath(processingDir: string): string {
  return join(processingDir, RUN_STATUS_FILE)
}

export function initRunStatus(
  processingDir: string,
  runId: string,
  startedAt: string,
): RunStatusFile {
  const next: RunStatusFile = {
    version: 1,
    runId,
    startedAt,
    updatedAt: startedAt,
    inProgress: true,
    shared: {},
    areas: {},
  }
  writeAtomic(runStatusPath(processingDir), next)
  return next
}

export function mutateRunStatus(
  processingDir: string,
  mutate: (current: RunStatusFile) => RunStatusFile,
): RunStatusFile {
  const path = runStatusPath(processingDir)
  const current =
    readRunStatusOrNull(path) ?? initRunStatus(processingDir, `unknown-${Date.now()}`, safeNow())
  const mutated = mutate(current)
  const next = {
    ...mutated,
    updatedAt: safeNow(),
  }
  writeAtomic(path, next)
  return next
}

export function upsertSharedBranchStatus(
  processingDir: string,
  step: string,
  branch: Omit<RunStatusBranch, 'updatedAt'>,
): RunStatusFile {
  return mutateRunStatus(processingDir, (current) => ({
    ...current,
    shared: {
      ...current.shared,
      [step]: {
        ...branch,
        updatedAt: safeNow(),
      },
    },
  }))
}

export function upsertAreaCompareStatus(
  processingDir: string,
  area: string,
  branch: Omit<RunStatusCompareBranch, 'updatedAt'>,
): RunStatusFile {
  return mutateRunStatus(processingDir, (current) => ({
    ...current,
    areas: {
      ...current.areas,
      [area]: {
        ...current.areas[area],
        compare: {
          ...branch,
          updatedAt: safeNow(),
        },
      },
    },
  }))
}

export function upsertAreaOfficialDownloadStatus(
  processingDir: string,
  area: string,
  branch: Omit<RunStatusBranch, 'updatedAt'>,
): RunStatusFile {
  return mutateRunStatus(processingDir, (current) => ({
    ...current,
    areas: {
      ...current.areas,
      [area]: {
        ...current.areas[area],
        officialDownload: {
          ...branch,
          updatedAt: safeNow(),
        },
      },
    },
  }))
}

export function finalizeRunStatus(
  processingDir: string,
  final: {
    runId: string
    startedAt: string
    status: 'ok' | 'fail'
    updatedAt?: string
  },
): RunStatusFile {
  const path = runStatusPath(processingDir)
  const current = readRunStatusOrNull(path)
  const next: RunStatusFile = {
    version: 1,
    runId: final.runId,
    startedAt: final.startedAt,
    updatedAt: final.updatedAt ?? safeNow(),
    inProgress: false,
    status: final.status,
    shared: current?.shared ?? {},
    areas: current?.areas ?? {},
  }
  writeAtomic(path, next)
  return next
}
