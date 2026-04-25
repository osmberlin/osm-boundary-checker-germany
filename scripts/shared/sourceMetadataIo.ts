import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  areaSourceMetadataFileSchema,
  type AreaSourceMetadataFile,
  SOURCE_METADATA_FILE,
} from './sourceMetadata.ts'

function readMetadataAt(path: string): AreaSourceMetadataFile | null {
  if (!existsSync(path)) return null
  try {
    return areaSourceMetadataFileSchema.parse(JSON.parse(readFileSync(path, 'utf-8')) as unknown)
  } catch {
    return null
  }
}

export function readAreaSourceMetadataFile(areaPath: string): AreaSourceMetadataFile | null {
  const dir = join(areaPath, 'source')
  const primary = join(dir, SOURCE_METADATA_FILE)
  return readMetadataAt(primary)
}

export function writeAreaSourceMetadataFile(areaPath: string, data: AreaSourceMetadataFile): void {
  const dir = join(areaPath, 'source')
  mkdirSync(dir, { recursive: true })
  const p = join(dir, SOURCE_METADATA_FILE)
  const normalized = areaSourceMetadataFileSchema.parse(data)
  writeFileSync(p, JSON.stringify(normalized, null, 2), 'utf-8')
}
