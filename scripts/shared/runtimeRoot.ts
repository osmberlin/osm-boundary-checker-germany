import { isAbsolute, resolve } from 'node:path'

/**
 * Runtime data root for mutable artifacts (datasets output, caches, processing logs).
 * Defaults to the workspace root for local development.
 */
export function runtimeRootFromWorkspace(workspaceRoot: string): string {
  const envValue = process.env.DATA_ROOT?.trim()
  if (!envValue) return workspaceRoot
  return isAbsolute(envValue) ? envValue : resolve(workspaceRoot, envValue)
}
