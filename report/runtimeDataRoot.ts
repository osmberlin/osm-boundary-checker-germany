import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { DATASETS_DIRECTORY } from '../scripts/shared/datasetPaths.ts'

const reportRoot = import.meta.dir
const repoRoot = resolve(reportRoot, '..')

export function resolveRuntimeRoot(): string {
  const configured = process.env.DATA_ROOT?.trim()
  if (configured == null || configured === '') return repoRoot
  return resolve(configured)
}

export function runtimeDatasetsRoot(runtimeRoot: string): string {
  return join(runtimeRoot, DATASETS_DIRECTORY)
}

export function assertDatasetsRootExists(runtimeRoot: string, context: string): string {
  const datasetsRoot = runtimeDatasetsRoot(runtimeRoot)
  if (!existsSync(datasetsRoot)) {
    throw new Error(
      `[${context}] Missing datasets root: ${datasetsRoot}. Set DATA_ROOT to a runtime tree containing datasets/.`,
    )
  }
  return datasetsRoot
}
