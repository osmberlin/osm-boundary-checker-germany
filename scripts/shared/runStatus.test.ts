import { describe, expect, it } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  finalizeRunStatus,
  initRunStatus,
  runStatusPath,
  upsertAreaCompareStatus,
  upsertSharedBranchStatus,
} from './runStatus.ts'

describe('runStatus', () => {
  it('writes and updates run status incrementally', () => {
    const root = mkdtempSync(join(tmpdir(), 'run-status-test-'))
    try {
      const processingDir = join(root, 'data')
      initRunStatus(processingDir, 'run-1', '2026-01-01T00:00:00.000Z')
      upsertSharedBranchStatus(processingDir, 'download:osm', {
        status: 'success',
        usedCache: false,
      })
      upsertAreaCompareStatus(processingDir, 'de-staat', {
        status: 'compare_failed',
        usedCache: true,
        compareOutputOrigin: 'cache_last_good',
      })
      finalizeRunStatus(processingDir, {
        runId: 'run-1',
        startedAt: '2026-01-01T00:00:00.000Z',
        status: 'fail',
      })
      const parsed = JSON.parse(readFileSync(runStatusPath(processingDir), 'utf-8')) as {
        status?: string
        shared: Record<string, { status: string }>
        areas: Record<string, { compare?: { status: string; usedCache?: boolean } }>
      }
      expect(parsed.status).toBe('fail')
      expect(parsed.shared['download:osm']?.status).toBe('success')
      expect(parsed.areas['de-staat']?.compare?.status).toBe('compare_failed')
      expect(parsed.areas['de-staat']?.compare?.usedCache).toBe(true)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
