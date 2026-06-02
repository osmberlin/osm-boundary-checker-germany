import { describe, expect, it } from 'bun:test'
import {
  evaluateOsmDownloadPolicy,
  MAX_CONSECUTIVE_OSM_FALLBACK_RUNS,
  resolveOsmDownloadOutcome,
} from './osmPipelineState.ts'

describe('resolveOsmDownloadOutcome', () => {
  it('maps fallback restore to fallback_artifact', () => {
    expect(
      resolveOsmDownloadOutcome({
        stepStatus: 'skipped',
        usedCache: true,
        reason: 'fallback_osm_cache_restored',
      }),
    ).toBe('fallback_artifact')
  })

  it('maps fresh success to fresh', () => {
    expect(
      resolveOsmDownloadOutcome({
        stepStatus: 'ok',
        usedCache: false,
      }),
    ).toBe('fresh')
  })
})

describe('evaluateOsmDownloadPolicy', () => {
  it('resets streak when fresh attempt succeeds', () => {
    const result = evaluateOsmDownloadPolicy({
      previousState: {
        version: 1,
        consecutiveFallbackRuns: 2,
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      attempts: {
        version: 1,
        runId: 'run-1',
        fresh: {
          attempt: 'fresh',
          outcome: 'fresh',
          at: '2026-01-02T00:00:00.000Z',
        },
      },
    })
    expect(result.ok).toBe(true)
    expect(result.consecutiveFallbackRuns).toBe(0)
    expect(result.finalOutcome).toBe('fresh')
  })

  it('allows fallback within streak limit', () => {
    const result = evaluateOsmDownloadPolicy({
      previousState: {
        version: 1,
        consecutiveFallbackRuns: 1,
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      attempts: {
        version: 1,
        runId: 'run-2',
        fresh: {
          attempt: 'fresh',
          outcome: 'failed',
          at: '2026-01-02T00:00:00.000Z',
          errorMessage: 'curl exit 28',
        },
        fallback: {
          attempt: 'fallback',
          outcome: 'fallback_artifact',
          at: '2026-01-02T00:05:00.000Z',
        },
      },
    })
    expect(result.ok).toBe(true)
    expect(result.consecutiveFallbackRuns).toBe(2)
    expect(result.errorMessage).toBe('curl exit 28')
  })

  it('fails when fallback streak exceeds limit', () => {
    const result = evaluateOsmDownloadPolicy({
      previousState: {
        version: 1,
        consecutiveFallbackRuns: MAX_CONSECUTIVE_OSM_FALLBACK_RUNS,
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      attempts: {
        version: 1,
        runId: 'run-3',
        fresh: {
          attempt: 'fresh',
          outcome: 'failed',
          at: '2026-01-02T00:00:00.000Z',
          errorMessage: 'timeout',
        },
        fallback: {
          attempt: 'fallback',
          outcome: 'fallback_artifact',
          at: '2026-01-02T00:05:00.000Z',
        },
      },
    })
    expect(result.ok).toBe(false)
    expect(result.consecutiveFallbackRuns).toBe(MAX_CONSECUTIVE_OSM_FALLBACK_RUNS + 1)
  })

  it('fails when both attempts fail', () => {
    const result = evaluateOsmDownloadPolicy({
      previousState: null,
      attempts: {
        version: 1,
        runId: 'run-4',
        fresh: {
          attempt: 'fresh',
          outcome: 'failed',
          at: '2026-01-02T00:00:00.000Z',
          errorMessage: 'network error',
        },
        fallback: {
          attempt: 'fallback',
          outcome: 'failed',
          at: '2026-01-02T00:05:00.000Z',
          errorMessage: 'no fallback artifact',
        },
      },
    })
    expect(result.ok).toBe(false)
    expect(result.finalOutcome).toBe('failed')
    expect(result.errorMessage).toBe('no fallback artifact')
  })
})
