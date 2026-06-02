#!/usr/bin/env bun
import { spawnSync, type SpawnSyncReturns } from 'node:child_process'
/**
 * Commits chart + /status history after a successful refresh (main only).
 * @see scripts/shared/dataCommitMessages.ts
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { DATA_RUNTIME_HISTORY_COMMIT_MSG } from '../shared/dataCommitMessages.ts'
import { workspaceRootFromHere } from '../shared/workspaceRoot.ts'
import { normalizeProcessingLogJsonlText } from './normalize-processing-log-jsonl.ts'

const GITHUB_BOT_NAME = 'github-actions[bot]'
const GITHUB_BOT_EMAIL = '41898282+github-actions[bot]@users.noreply.github.com'

const PROCESSING_LOG_REL = join('data', 'processing-log.jsonl')

function appendStepSummary(line: string): void {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY?.trim()
  if (!summaryPath) return
  appendFileSync(summaryPath, `${line}\n`, 'utf-8')
}

function runGit(args: string[], options?: { allowFailure?: boolean }): SpawnSyncReturns<string> {
  const result = spawnSync('git', args, {
    encoding: 'utf-8',
    stdio: options?.allowFailure ? ['inherit', 'pipe', 'pipe'] : 'inherit',
  })
  if (result.status !== 0 && !options?.allowFailure) {
    const stderr = result.stderr?.trim() ?? ''
    throw new Error(
      `git ${args.join(' ')} failed (exit ${result.status})${stderr ? `: ${stderr}` : ''}`,
    )
  }
  return result
}

function gitBotConfig(): string[] {
  return ['-c', `user.name=${GITHUB_BOT_NAME}`, '-c', `user.email=${GITHUB_BOT_EMAIL}`]
}

function normalizeProcessingLogIfPresent(workspaceRoot: string): void {
  const path = join(workspaceRoot, PROCESSING_LOG_REL)
  if (!existsSync(path)) return
  const normalized = normalizeProcessingLogJsonlText(readFileSync(path, 'utf-8'))
  writeFileSync(path, normalized, 'utf-8')
  const lineCount = normalized.trim() === '' ? 0 : normalized.trimEnd().split('\n').length
  console.log(`[persist-runtime-history] Normalized ${lineCount} events in ${PROCESSING_LOG_REL}`)
}

function main(): void {
  const workspaceRoot = workspaceRootFromHere(import.meta.url)
  const commitMsg = process.env.COMMIT_MSG?.trim() || DATA_RUNTIME_HISTORY_COMMIT_MSG

  appendStepSummary('### Git identity preflight')
  for (const ident of ['GIT_AUTHOR_IDENT', 'GIT_COMMITTER_IDENT'] as const) {
    const result = runGit(['var', ident], { allowFailure: true })
    const line = result.stdout?.trim()
    if (line) {
      console.log(line)
      appendStepSummary(line)
    }
  }

  runGit(['switch', '-c', 'runtime-history'])
  normalizeProcessingLogIfPresent(workspaceRoot)

  runGit(['add', ':(glob)datasets/*/snapshots.json'])
  const logPath = join(workspaceRoot, PROCESSING_LOG_REL)
  if (existsSync(logPath)) {
    runGit(['add', PROCESSING_LOG_REL])
  }

  const diff = runGit(['diff', '--cached', '--quiet'], { allowFailure: true })
  if (diff.status === 0) {
    console.log('No runtime history changes to commit.')
    return
  }

  runGit([...gitBotConfig(), 'commit', '-m', commitMsg])
  runGit([...gitBotConfig(), 'pull', '--rebase', '--autostash', 'origin', 'main'])
  runGit(['push', 'origin', 'HEAD:main'])
}

main()
