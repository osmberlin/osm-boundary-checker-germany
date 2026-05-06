import { spawnSync } from 'node:child_process'

export type OsmPbfIntegrityResult =
  | { ok: true }
  /** PBF appears truncated/corrupt, or osmium rejected the file. Safe to delete and re-download. */
  | { ok: false; detail: string; canDeleteCorruptCache: true }
  /** osmium missing or failed to start — do not delete the PBF; fix the environment. */
  | { ok: false; detail: string; canDeleteCorruptCache: false }

/**
 * Full read of the PBF blob list via `osmium fileinfo -e`.
 * Truncated downloads often pass a plain `fileinfo` call but fail here with `unexpected EOF`.
 */
export function checkOsmPbfIntegrity(path: string): OsmPbfIntegrityResult {
  const r = spawnSync('osmium', ['fileinfo', '-e', path], {
    encoding: 'utf-8',
    maxBuffer: 4 * 1024 * 1024,
  })
  if (r.error) {
    return {
      ok: false,
      detail: r.error.message,
      canDeleteCorruptCache: false,
    }
  }
  if (r.status !== 0) {
    const err = (r.stderr ?? '').trim()
    return {
      ok: false,
      detail: err.length > 0 ? err : `osmium exited with status ${r.status}`,
      canDeleteCorruptCache: true,
    }
  }
  return { ok: true }
}
