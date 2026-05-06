import { describe, expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checkOsmPbfIntegrity } from './osmPbfIntegrity.ts'

const hasOsmium = spawnSync('osmium', ['--version'], { encoding: 'utf-8' }).status === 0

describe('checkOsmPbfIntegrity', () => {
  test.skipIf(!hasOsmium)('rejects a truncated fake PBF', () => {
    const dir = mkdtempSync(join(tmpdir(), 'osm-pbf-integ-'))
    try {
      const path = join(dir, 'bad.pbf')
      // Valid-looking PBF magic is insufficient; osmium -e should error quickly on garbage.
      writeFileSync(path, Buffer.from('OSMHeader\x00\x00\x00\x00truncated'))
      const r = checkOsmPbfIntegrity(path)
      expect(r.ok).toBe(false)
      if (!r.ok) {
        expect(r.detail.length).toBeGreaterThan(0)
      }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
