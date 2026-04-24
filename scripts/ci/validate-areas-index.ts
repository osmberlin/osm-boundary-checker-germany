import { existsSync } from 'node:fs'

/**
 * WHAT: Validates generated `report/src/data/areasIndex.gen.ts` contains at least one area entry.
 * WHY: Even though refresh validates before upload, deploy is a separate workflow and keeps this cheap guard to fail fast before publishing.
 * WHY (ALSO): This protects manual/independent deploy triggers and any future drift between artifact production and deploy consumption.
 */
type AreaIndex = {
  areas?: unknown
}

const areaIndexPath = new URL('../../report/src/data/areasIndex.gen.ts', import.meta.url)
if (!existsSync(areaIndexPath)) {
  throw new Error('Missing report/src/data/areasIndex.gen.ts; run report:generate-areas first.')
}
const mod = (await import(areaIndexPath.href)) as { default?: AreaIndex }
const parsed = mod.default ?? {}

if (!Array.isArray(parsed.areas) || parsed.areas.length === 0) {
  throw new Error('areasIndex.gen.ts has no areas; refusing to deploy empty site.')
}

console.log(`areas: ${parsed.areas.length}`)
