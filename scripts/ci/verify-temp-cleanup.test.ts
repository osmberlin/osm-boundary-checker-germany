import { describe, expect, it } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

function hasTempLikeEntries(root: string): boolean {
  const entries = Bun.spawnSync({
    cmd: ['bun', 'scripts/ci/verify-temp-cleanup.ts'],
    cwd: root,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  return entries.exitCode !== 0
}

describe('verify-temp-cleanup', () => {
  const repoRoot = process.cwd()

  it('fails when temporary directories are present', () => {
    const tempDir = join(repoRoot, '.cache', 'temp.tmp-123')
    mkdirSync(tempDir, { recursive: true })
    try {
      expect(hasTempLikeEntries(repoRoot)).toBe(true)
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('fails when temporary files are present', () => {
    const tempFile = join(repoRoot, 'datasets', '.marker.tmp')
    mkdirSync(join(repoRoot, 'datasets'), { recursive: true })
    writeFileSync(tempFile, 'x')
    try {
      expect(hasTempLikeEntries(repoRoot)).toBe(true)
    } finally {
      rmSync(tempFile, { force: true })
    }
  })
})
