import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DTP_CACHE_DIR, DTP_DOWNLOAD_METADATA } from './constants.ts'
import {
  DTP_CACHE_ARTIFACT_FILES,
  dtpCacheReady,
  dtpPipelineDownloadArgs,
  dtpSyncedWithin,
} from './pipeline.ts'

const workflowPath = new URL('../../../.github/workflows/data-refresh.yml', import.meta.url)

describe('DtP pipeline', () => {
  test('the workflow uploads exactly the cache files the next run needs', () => {
    const workflow = readFileSync(workflowPath, 'utf8')
    const block = /name: source-cache-dtp\n\s+path: \|\n((?:\s+\.cache\/dtp\/\S+\n)+)/.exec(
      workflow,
    )
    expect(block).not.toBeNull()
    const uploaded = block![1]!
      .trim()
      .split('\n')
      .map((line) => line.trim().replace(`${DTP_CACHE_DIR}/`, ''))
    expect(uploaded.sort()).toEqual([...DTP_CACHE_ARTIFACT_FILES].sort())
  })

  test('the cache is ready only when every file extract:dtp reads exists', () => {
    const root = mkdtempSync(join(tmpdir(), 'dtp-pipeline-'))
    expect(dtpCacheReady(root)).toBe(false)
    mkdirSync(join(root, DTP_CACHE_DIR), { recursive: true })
    for (const file of DTP_CACHE_ARTIFACT_FILES) {
      writeFileSync(join(root, DTP_CACHE_DIR, file), '{}')
    }
    expect(dtpCacheReady(root)).toBe(true)
  })

  test('the pipeline sync is bounded by time, not by count', () => {
    expect(dtpPipelineDownloadArgs()).toEqual(['--full', '--max-minutes', '60'])
  })

  test('a sync of this job counts as done for the repeated download phase, older ones do not', () => {
    const root = mkdtempSync(join(tmpdir(), 'dtp-pipeline-'))
    const hour = 60 * 60 * 1000
    const now = Date.parse('2026-10-26T06:00:00Z')
    expect(dtpSyncedWithin(root, 6 * hour, now)).toBe(false)
    mkdirSync(join(root, DTP_CACHE_DIR), { recursive: true })
    const write = (downloadedAt: string) =>
      writeFileSync(
        join(root, DTP_CACHE_DIR, DTP_DOWNLOAD_METADATA),
        JSON.stringify({ downloadedAt }),
      )
    write('2026-10-26T05:10:00Z')
    expect(dtpSyncedWithin(root, 6 * hour, now)).toBe(true)
    // Restored from the run three days ago: the repeat must sync again.
    write('2026-10-23T04:00:00Z')
    expect(dtpSyncedWithin(root, 6 * hour, now)).toBe(false)
  })
})
