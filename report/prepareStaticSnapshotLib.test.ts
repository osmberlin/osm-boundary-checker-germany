import { describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  COMMITTED_PUBLIC_DATA_BASENAMES,
  removeGeneratedPublicData,
} from './prepareStaticSnapshotLib.ts'

function makePublicDataRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'public-data-'))
  writeFileSync(join(root, 'german-key-lookup.json'), '{"lookup":true}')
  writeFileSync(join(root, 'ars-successors.json'), '{"successors":[]}')
  writeFileSync(join(root, 'processing-state.json'), '{"phase":"compare"}')
  mkdirSync(join(root, 'regional-hub'), { recursive: true })
  writeFileSync(join(root, 'regional-hub', 'manifest.json'), '{}')
  return root
}

describe('removeGeneratedPublicData', () => {
  test('keeps german-key-lookup.json and ars-successors.json', async () => {
    const root = makePublicDataRoot()
    try {
      await removeGeneratedPublicData(root)
      expect(COMMITTED_PUBLIC_DATA_BASENAMES).toEqual([
        'german-key-lookup.json',
        'ars-successors.json',
      ])
      expect(readFileSync(join(root, 'german-key-lookup.json'), 'utf8')).toBe('{"lookup":true}')
      expect(readFileSync(join(root, 'ars-successors.json'), 'utf8')).toBe('{"successors":[]}')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('deletes other files and dirs', async () => {
    const root = makePublicDataRoot()
    try {
      await removeGeneratedPublicData(root)
      expect(existsSync(join(root, 'processing-state.json'))).toBe(false)
      expect(existsSync(join(root, 'regional-hub'))).toBe(false)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
