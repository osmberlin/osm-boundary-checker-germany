import { describe, expect, test } from 'bun:test'
import { tippecanoeArgs } from './runTippecanoe.ts'

describe('tippecanoeArgs', () => {
  test('omits minimum-zoom when minZoom is zero', () => {
    const args = tippecanoeArgs('/tmp/in.fgb', '/tmp/out.pmtiles', { minZoom: 0 })
    expect(args.some((x) => x.startsWith('--minimum-zoom'))).toBe(false)
  })

  test('inserts --minimum-zoom before detail/simplification flags when minZoom > 0', () => {
    const args = tippecanoeArgs('/tmp/in.fgb', '/tmp/out.pmtiles', { minZoom: 5 })
    const layerI = args.findIndex((x) => x === 'boundaries')
    const minI = args.findIndex((x) => x.startsWith('--minimum-zoom='))
    const lowDetailI = args.findIndex((x) => x.startsWith('--low-detail='))
    expect(minI).toBeGreaterThan(-1)
    expect(layerI).toBeGreaterThan(-1)
    expect(lowDetailI).toBeGreaterThan(-1)
    expect(minI).toBe(layerI + 1)
    expect(minI).toBeLessThan(lowDetailI)
    expect(args[minI]).toBe('--minimum-zoom=5')
  })

  test('uses defaults-first simplification/detail policy', () => {
    const args = tippecanoeArgs('/tmp/in.fgb', '/tmp/out.pmtiles', { minZoom: 0 })
    expect(args).toContain('--no-simplification-of-shared-nodes')
    expect(args).toContain('--simplify-only-low-zooms')
    expect(args).toContain('--low-detail=9')
    expect(args).not.toContain('--full-detail=15')
    expect(args.some((x) => x.startsWith('--full-detail='))).toBe(false)
    expect(args.some((x) => x.startsWith('--simplification='))).toBe(false)
    expect(args.some((x) => x.startsWith('--maximum-zoom='))).toBe(false)
  })
})
