import { readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * WHAT: Validates that `areas.gen.json` exists and contains at least one area entry.
 * WHY: Even though refresh validates before upload, deploy is a separate workflow and keeps this cheap guard to fail fast before publishing.
 * WHY (ALSO): This protects manual/independent deploy triggers and any future drift between artifact production and deploy consumption.
 */
type AreaIndex = {
  areas?: unknown
}

const areaIndexPath = path.resolve('areas.gen.json')
const raw = readFileSync(areaIndexPath, 'utf8')
const parsed = JSON.parse(raw) as AreaIndex

if (!Array.isArray(parsed.areas) || parsed.areas.length === 0) {
  throw new Error('areas.gen.json has no areas; refusing to deploy empty site.')
}

console.log(`areas: ${parsed.areas.length}`)
