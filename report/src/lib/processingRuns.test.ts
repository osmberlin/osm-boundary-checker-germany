import { describe, expect, it } from 'vitest'
import {
  buildRunsFromEvents,
  classifyRunPhase,
  computeStatusKpis,
  type LogEvent,
} from './processingRuns'

describe('classifyRunPhase', () => {
  it('classifies download-only', () => {
    expect(
      classifyRunPhase({
        stepSummaries: [{ id: 'download:osm', status: 'ok', at: '' }],
        datasetSummaries: [],
      }),
    ).toBe('download')
  })

  it('classifies extract-only', () => {
    expect(
      classifyRunPhase({
        stepSummaries: [{ id: 'extract:osm', status: 'ok', at: '' }],
        datasetSummaries: [],
      }),
    ).toBe('extract')
  })

  it('classifies compare from datasets', () => {
    expect(
      classifyRunPhase({
        stepSummaries: [],
        datasetSummaries: [{ dataset: 'berlin-bezirke', status: 'ok', durationMs: 1, at: '' }],
      }),
    ).toBe('compare')
  })
})

describe('buildRunsFromEvents', () => {
  it('aggregates run_start and run_end', () => {
    const events: LogEvent[] = [
      { kind: 'run_start', runId: 'r1', at: '2026-06-01T04:00:00.000Z' },
      {
        kind: 'run_end',
        runId: 'r1',
        at: '2026-06-01T04:10:00.000Z',
        status: 'ok',
        durationMs: 600_000,
      },
      {
        kind: 'step_end',
        runId: 'r1',
        at: '2026-06-01T04:05:00.000Z',
        step: 'download:osm',
        status: 'ok',
      },
    ]
    const runs = buildRunsFromEvents(events)
    expect(runs).toHaveLength(1)
    expect(runs[0]?.phase).toBe('download')
    expect(runs[0]?.status).toBe('ok')
  })
})

describe('computeStatusKpis', () => {
  it('picks latest successful compare end', () => {
    const runs = buildRunsFromEvents([
      { kind: 'run_start', runId: 'c1', at: '2026-06-01T06:00:00.000Z' },
      { kind: 'run_end', runId: 'c1', at: '2026-06-01T07:00:00.000Z', status: 'ok', durationMs: 1 },
      {
        kind: 'dataset_end',
        runId: 'c1',
        at: '2026-06-01T07:00:00.000Z',
        dataset: 'x',
        status: 'ok',
        durationMs: 1,
        exitCode: 0,
      },
    ])
    const kpis = computeStatusKpis(runs, null)
    expect(kpis.lastCompareOkAt).toBe('2026-06-01T07:00:00.000Z')
  })
})
