#!/usr/bin/env bun
/**
 * Normalizes **gitignored** BKG cache metadata (`.cache/bkg/download-metadata.json`) when an
 * older Actions cache or local cache still has `zipLastFetchedAt` instead of `downloadedAt`.
 * Fresh `bkg/download.ts` runs always emit the current shape (`bkgDownloadMetadataSchema`); this
 * script only repairs **restored** cache files, not checked-in repo data.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { runtimeRootFromWorkspace } from '../shared/runtimeRoot.ts'
import { workspaceRootFromHere } from '../shared/workspaceRoot.ts'

type JsonObject = Record<string, unknown>

type MigrationStats = {
  filesScanned: number
  filesChanged: number
  bkgDownloadedAtBackfills: number
  bkgLegacyKeyRemovals: number
}

function readJsonFile(filePath: string): unknown {
  const raw = readFileSync(filePath, 'utf-8')
  return JSON.parse(raw) as unknown
}

function writeJsonFile(filePath: string, value: unknown): void {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8')
}

function migrateBkgDownloadMetadata(runtimeRoot: string, stats: MigrationStats): void {
  const bkgMetaPath = path.join(runtimeRoot, '.cache', 'bkg', 'download-metadata.json')
  if (!existsSync(bkgMetaPath)) return
  stats.filesScanned += 1
  const parsed = readJsonFile(bkgMetaPath)
  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) return
  const source = parsed as JsonObject
  const migrated: JsonObject = { ...source }

  const downloadedAt = typeof source.downloadedAt === 'string' ? source.downloadedAt.trim() : ''
  const zipLastFetchedAt =
    typeof source.zipLastFetchedAt === 'string' ? source.zipLastFetchedAt.trim() : ''
  if (!downloadedAt && zipLastFetchedAt) {
    migrated.downloadedAt = zipLastFetchedAt
    stats.bkgDownloadedAtBackfills += 1
  }
  if ('zipLastFetchedAt' in migrated) {
    delete migrated.zipLastFetchedAt
    stats.bkgLegacyKeyRemovals += 1
  }

  if (JSON.stringify(source) !== JSON.stringify(migrated)) {
    writeJsonFile(bkgMetaPath, migrated)
    stats.filesChanged += 1
  }
}

export function normalizeSourceMetadataAtRoot(runtimeRoot: string): MigrationStats {
  const stats: MigrationStats = {
    filesScanned: 0,
    filesChanged: 0,
    bkgDownloadedAtBackfills: 0,
    bkgLegacyKeyRemovals: 0,
  }

  migrateBkgDownloadMetadata(runtimeRoot, stats)

  return stats
}

function main(): void {
  const workspaceRoot = workspaceRootFromHere(import.meta.url)
  const runtimeRoot = runtimeRootFromWorkspace(workspaceRoot)
  const stats = normalizeSourceMetadataAtRoot(runtimeRoot)

  console.log('[migrate:source-metadata] done')
  console.log(`[migrate:source-metadata] runtimeRoot=${runtimeRoot}`)
  console.log(
    `[migrate:source-metadata] filesScanned=${stats.filesScanned} filesChanged=${stats.filesChanged}`,
  )
  console.log(
    `[migrate:source-metadata] bkgDownloadedAtBackfills=${stats.bkgDownloadedAtBackfills} bkgLegacyKeyRemovals=${stats.bkgLegacyKeyRemovals}`,
  )
  console.log(
    '[migrate:source-metadata] retire when BKG caches are too new for zipLastFetchedAt: delete normalize-source-metadata.ts + .test.ts, remove migrate:source-metadata (root + scripts package.json), drop its step from data-refresh.yml, trim the migrate note in docs/processing-and-analysis.md',
  )
}

if (import.meta.main) {
  main()
}
