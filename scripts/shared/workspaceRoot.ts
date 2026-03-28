import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Returns `osm-boundary-checker-germany/` for any module under `scripts/<subdir>/file.ts`
 * (two levels up from that file’s directory).
 */
export function workspaceRootFromHere(importMetaUrl: string): string {
  const here = dirname(fileURLToPath(importMetaUrl))
  return join(here, '..', '..')
}
