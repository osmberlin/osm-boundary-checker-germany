import { describe, expect, it } from 'bun:test'
import { buildOsmDownloadAlert } from './osmDownloadStatus'

describe('buildOsmDownloadAlert', () => {
  it('returns failed alert when branch failed', () => {
    const alert = buildOsmDownloadAlert({
      osmBranch: {
        status: 'failed_no_cache',
        updatedAt: '2026-01-01T00:00:00.000Z',
        errorMessage: 'timeout',
      },
      pipelineState: null,
    })
    expect(alert?.kind).toBe('failed')
    expect(alert?.detail).toContain('timeout')
  })

  it('returns fallback alert when source is fallback artifact', () => {
    const alert = buildOsmDownloadAlert({
      osmBranch: {
        status: 'success',
        updatedAt: '2026-01-01T00:00:00.000Z',
        usedCache: true,
        sourceOrigin: 'fallback_artifact',
        errorMessage: 'curl exit 28',
      },
      pipelineState: {
        version: 1,
        consecutiveFallbackRuns: 1,
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    })
    expect(alert?.kind).toBe('fallback')
    expect(alert?.detail).toContain('curl exit 28')
  })

  it('returns null for fresh download', () => {
    const alert = buildOsmDownloadAlert({
      osmBranch: {
        status: 'success',
        updatedAt: '2026-01-01T00:00:00.000Z',
        sourceOrigin: 'fresh',
      },
      pipelineState: {
        version: 1,
        consecutiveFallbackRuns: 0,
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    })
    expect(alert).toBeNull()
  })
})
