import { describe, expect, test } from 'bun:test'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { normalizeSourceMetadataAtRoot } from './normalize-source-metadata.ts'

function writeJson(filePath: string, value: unknown): void {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8')
}

function readJson(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, 'utf-8')) as unknown
}

describe('normalizeSourceMetadataAtRoot', () => {
  test('migrates legacy BKG cache download-metadata (zipLastFetchedAt → downloadedAt)', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'bkg-cache-migration-'))
    try {
      const bkgMeta = path.join(root, '.cache', 'bkg', 'download-metadata.json')
      mkdirSync(path.dirname(bkgMeta), { recursive: true })
      writeJson(bkgMeta, {
        sourceUpdatedAt: '2026-01-01T00:00:00.000Z',
        sourceUpdatedAtVerifiedAt: '2026-01-02T00:00:00.000Z',
        zipLastFetchedAt: '2026-01-03T00:00:00.000Z',
        sourceUrl: 'https://example.test/file.zip',
        zipRelativePath: '.cache/bkg/file.zip',
        gpkgRelativePath: '.cache/bkg/file.gpkg',
      })

      const stats = normalizeSourceMetadataAtRoot(root)
      expect(stats.filesScanned).toBe(1)
      expect(stats.filesChanged).toBe(1)
      expect(stats.bkgDownloadedAtBackfills).toBe(1)
      expect(stats.bkgLegacyKeyRemovals).toBe(1)

      const bkgParsed = readJson(bkgMeta) as { downloadedAt?: string; zipLastFetchedAt?: string }
      expect(bkgParsed.downloadedAt).toBe('2026-01-03T00:00:00.000Z')
      expect('zipLastFetchedAt' in bkgParsed).toBe(false)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('is idempotent when BKG cache file is already canonical', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'bkg-cache-migration-'))
    try {
      const bkgMeta = path.join(root, '.cache', 'bkg', 'download-metadata.json')
      mkdirSync(path.dirname(bkgMeta), { recursive: true })
      writeJson(bkgMeta, {
        sourceUpdatedAt: '2026-01-01T00:00:00.000Z',
        sourceUpdatedAtVerifiedAt: '2026-01-02T00:00:00.000Z',
        downloadedAt: '2026-01-03T00:00:00.000Z',
        sourceUrl: 'https://example.test/file.zip',
        zipRelativePath: '.cache/bkg/file.zip',
        gpkgRelativePath: '.cache/bkg/file.gpkg',
      })

      const first = normalizeSourceMetadataAtRoot(root)
      const second = normalizeSourceMetadataAtRoot(root)
      expect(first.filesScanned).toBe(1)
      expect(first.filesChanged).toBe(0)
      expect(second.filesChanged).toBe(0)
      expect(second.bkgDownloadedAtBackfills).toBe(0)
      expect(second.bkgLegacyKeyRemovals).toBe(0)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('no-op when BKG cache file is absent', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'bkg-cache-migration-'))
    try {
      const stats = normalizeSourceMetadataAtRoot(root)
      expect(stats.filesScanned).toBe(0)
      expect(stats.filesChanged).toBe(0)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
