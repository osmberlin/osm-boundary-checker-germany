import { describe, expect, test } from 'bun:test'
import { summarizeSiteSize } from './check-site-size.ts'

describe('summarizeSiteSize', () => {
  test('groups dataset files by kind and sorts the largest dataset first', () => {
    const report = summarizeSiteSize(
      [
        { path: 'datasets/a/output/comparison.pmtiles', bytes: 30 },
        { path: 'datasets/a/output/official_for_edit/1.geojson', bytes: 5 },
        { path: 'datasets/a/output/official_for_edit/2.geojson', bytes: 5 },
        { path: 'datasets/b/output/features/x.json', bytes: 50 },
        { path: 'assets/index.js', bytes: 10 },
      ],
      1000,
    )
    expect(report.totalBytes).toBe(100)
    expect(report.status).toBe('ok')
    expect(report.datasets.map((d) => d.id)).toEqual(['b', 'a'])
    expect(report.datasets[1]!.byKind).toEqual({ 'comparison.pmtiles': 30, official_for_edit: 10 })
  })

  test('warns from 90 % and fails above the limit', () => {
    expect(summarizeSiteSize([{ path: 'x', bytes: 91 }], 100).status).toBe('warn')
    expect(summarizeSiteSize([{ path: 'x', bytes: 101 }], 100).status).toBe('fail')
  })
})
