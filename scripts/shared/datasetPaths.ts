import { join } from 'node:path'

/** Top-level folder: one subfolder per comparison area (slug). */
export const DATASETS_DIRECTORY = 'datasets'
export const OFFICIAL_SOURCE_RELATIVE_PATH = 'source/official.fgb'
export const SOURCE_METADATA_RELATIVE_PATH = 'source/metadata.json'

export function datasetFolderPath(workspaceRoot: string, area: string): string {
  return join(workspaceRoot, DATASETS_DIRECTORY, area)
}
