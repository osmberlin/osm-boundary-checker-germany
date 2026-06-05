import { describe, expect, test } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { allBkgOfficialSourcesPresent, shouldSkipBkgExtract } from './lazyFallback.ts'
import { SOURCE_METADATA_FILE } from './sourceMetadata.ts'

function makeTempRoot(prefix: string): string {
  const root = join(tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(root, { recursive: true })
  return root
}

const sampleBkgAreaConfig = {
  displayName: 'Deutschland Länder',
  titlePrefix: 'Land',
  officialProfile: 'bkg_vg25_lan',
  osmProfile: 'admin_rs',
  idNormalization: { preset: 'regional-12' },
  metricsCrs: 'EPSG:25832',
  compare: {
    minZoom: 4,
    officialMatchProperty: 'ARS',
    bboxFilter: 'none',
    osmScopeFilter: 'none',
  },
  osm: { adminLevels: ['4'] },
}

describe('shouldSkipBkgExtract', () => {
  test('returns false when BKG cache is ready', () => {
    const runtimeRoot = makeTempRoot('bkg-skip-cache')
    try {
      mkdirSync(join(runtimeRoot, '.cache/bkg/extract'), { recursive: true })
      writeFileSync(
        join(runtimeRoot, '.cache/bkg/download-metadata.json'),
        JSON.stringify({
          sourceUpdatedAt: '2026-01-01T00:00:00.000Z',
          sourceUpdatedAtVerifiedAt: '2026-01-01T00:00:00.000Z',
          downloadedAt: '2026-01-01T00:00:00.000Z',
          sourceUrl: 'https://example.com/vg25.zip',
          zipRelativePath: '.cache/bkg/vg25.zip',
          gpkgRelativePath: '.cache/bkg/extract/vg25.gpkg',
        }),
      )
      writeFileSync(join(runtimeRoot, '.cache/bkg/extract/vg25.gpkg'), 'fake')
      expect(shouldSkipBkgExtract('/tmp/workspace', runtimeRoot)).toBe(false)
    } finally {
      rmSync(runtimeRoot, { recursive: true, force: true })
    }
  })

  test('returns true when BKG cache is missing but all official sources are present', () => {
    const workspaceRoot = makeTempRoot('bkg-skip-ws')
    const runtimeRoot = makeTempRoot('bkg-skip-rt')
    try {
      const area = 'de-laender'
      mkdirSync(join(workspaceRoot, 'datasets', area), { recursive: true })
      writeFileSync(
        join(workspaceRoot, 'datasets', area, 'config.jsonc'),
        JSON.stringify(sampleBkgAreaConfig),
      )
      const sourceDir = join(runtimeRoot, 'datasets', area, 'source')
      mkdirSync(sourceDir, { recursive: true })
      writeFileSync(join(sourceDir, 'official.fgb'), 'fake')
      writeFileSync(join(sourceDir, SOURCE_METADATA_FILE), '{}')
      expect(allBkgOfficialSourcesPresent(workspaceRoot, runtimeRoot)).toBe(true)
      expect(shouldSkipBkgExtract(workspaceRoot, runtimeRoot)).toBe(true)
    } finally {
      rmSync(workspaceRoot, { recursive: true, force: true })
      rmSync(runtimeRoot, { recursive: true, force: true })
    }
  })
})
