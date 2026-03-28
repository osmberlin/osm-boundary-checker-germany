import { join } from 'node:path'

/** Top-level folder: one subfolder per comparison area (slug). */
export const DATASETS_DIRECTORY = 'datasets'

export function datasetFolderPath(workspaceRoot: string, area: string): string {
  return join(workspaceRoot, DATASETS_DIRECTORY, area)
}
