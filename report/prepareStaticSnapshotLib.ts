import { closeSync, existsSync, openSync, unlinkSync } from 'node:fs'
import { readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** Basenames in `report/public/data/` that git keeps (`report/.gitignore` negations). */
export const COMMITTED_PUBLIC_DATA_BASENAMES = [
  'german-key-lookup.json',
  'ars-successors.json',
] as const

const committedPublicDataBasenames: ReadonlySet<string> = new Set(COMMITTED_PUBLIC_DATA_BASENAMES)

const SNAPSHOT_LOCK_PATH = join(tmpdir(), 'osm-boundary-checker-prepare-static-snapshot.lock')
const SNAPSHOT_LOCK_RETRY_MS = 120_000
const SNAPSHOT_LOCK_POLL_MS = 100

function errorCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = error.code
    return typeof code === 'string' ? code : undefined
  }
  return undefined
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Delete generated children of `report/public/data`, keeping committed lookup files.
 */
export async function removeGeneratedPublicData(destDataRoot: string): Promise<void> {
  if (!existsSync(destDataRoot)) return
  const entries = await readdir(destDataRoot, { withFileTypes: true })
  for (const entry of entries) {
    if (committedPublicDataBasenames.has(entry.name)) continue
    await rm(join(destDataRoot, entry.name), { recursive: true, force: true })
  }
}

/** Serialize concurrent `prepare-static-snapshot` runs (open `wx` / unlink). */
export async function withExclusiveSnapshotLock<T>(run: () => Promise<T>): Promise<T> {
  const deadline = Date.now() + SNAPSHOT_LOCK_RETRY_MS
  let fd = -1
  while (fd < 0) {
    try {
      fd = openSync(SNAPSHOT_LOCK_PATH, 'wx')
    } catch (error) {
      if (errorCode(error) !== 'EEXIST' || Date.now() >= deadline) throw error
      await sleep(SNAPSHOT_LOCK_POLL_MS)
    }
  }
  try {
    return await run()
  } finally {
    try {
      closeSync(fd)
    } catch {
      // ignore
    }
    try {
      unlinkSync(SNAPSHOT_LOCK_PATH)
    } catch {
      // ignore
    }
  }
}
