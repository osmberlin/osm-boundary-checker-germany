import { afterEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { areaHasOsmExtract, loadAreaConfig } from './areaConfig.ts'

const cleanup: string[] = []

afterEach(() => {
  while (cleanup.length > 0) {
    const dir = cleanup.pop()
    if (!dir) continue
    rmSync(dir, { recursive: true, force: true })
  }
})

function makeWorkspace(area: string, configText: string): string {
  const root = mkdtempSync(join(tmpdir(), 'area-config-'))
  cleanup.push(root)
  const areaDir = join(root, 'datasets', area)
  mkdirSync(areaDir, { recursive: true })
  writeFileSync(join(areaDir, 'config.jsonc'), configText, 'utf-8')
  return root
}

describe('loadAreaConfig', () => {
  test('loads valid area config object', () => {
    const root = makeWorkspace(
      'valid-config',
      '{ "displayName":"Valid Config","osmProfile":"admin_rs","official":{},"compare":{"officialMatchProperty":"ARS","bboxFilter":"none","osmScopeFilter":"none"},"idNormalization":{"preset":"regional-12"},"metricsCrs":"EPSG:25832","osm": {"extract": {"includeRelationIds": ["51477"]}} }',
    )
    const loaded = loadAreaConfig(root, 'valid-config')
    expect(loaded.officialMode).toBe('direct')
    if (loaded.officialMode !== 'direct') throw new Error('Expected direct config branch')
  })
})

describe('areaHasOsmExtract', () => {
  test('detects modern osm.extract arrays', () => {
    const root = makeWorkspace(
      'modern-osm-extract',
      '{ "displayName":"Modern OSM Extract","osmProfile":"admin_rs","official":{},"compare":{"officialMatchProperty":"ARS","bboxFilter":"none","osmScopeFilter":"none"},"idNormalization":{"preset":"regional-12"},"metricsCrs":"EPSG:25832","osm": {"extract": {"includeRelationIds": ["51477"]}} }',
    )
    expect(areaHasOsmExtract(root, 'modern-osm-extract')).toBe(true)
  })

  test('returns false when osm.extract is absent', () => {
    const root = makeWorkspace(
      'no-osm-extract',
      '{ "displayName":"No OSM Extract","osmProfile":"admin_rs","official":{},"compare":{"officialMatchProperty":"ARS","bboxFilter":"none","osmScopeFilter":"none"},"idNormalization":{"preset":"regional-12"},"metricsCrs":"EPSG:25832","osm": {} }',
    )
    expect(areaHasOsmExtract(root, 'no-osm-extract')).toBe(false)
  })
})
