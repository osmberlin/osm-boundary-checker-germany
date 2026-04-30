import { existsSync } from 'node:fs'

/**
 * WHAT: Validates generated `report/src/data/areasIndex.gen.ts` contains at least one area entry.
 * WHAT (ALSO): Validates generated `report/src/data/reviewQueue.gen.ts` exists and is parseable.
 * WHY: Even though refresh validates before upload, deploy is a separate workflow and keeps this cheap guard to fail fast before publishing.
 * WHY (ALSO): This protects manual/independent deploy triggers and any future drift between artifact production and deploy consumption.
 */
type AreaIndex = {
  areas?: unknown
}
type ReviewQueue = unknown[]

const areaIndexPath = new URL('../../report/src/data/areasIndex.gen.ts', import.meta.url)
if (!existsSync(areaIndexPath)) {
  throw new Error('Missing report/src/data/areasIndex.gen.ts; run report:generate-areas first.')
}
const reviewQueuePath = new URL('../../report/src/data/reviewQueue.gen.ts', import.meta.url)
if (!existsSync(reviewQueuePath)) {
  throw new Error('Missing report/src/data/reviewQueue.gen.ts; run report:generate-areas first.')
}

const mod = (await import(areaIndexPath.href)) as { default?: AreaIndex }
const parsed = mod.default ?? {}
const reviewQueueMod = (await import(reviewQueuePath.href)) as { default?: ReviewQueue }
const reviewQueueParsed = reviewQueueMod.default ?? []

if (!Array.isArray(parsed.areas) || parsed.areas.length === 0) {
  throw new Error('areasIndex.gen.ts has no areas; refusing to deploy empty site.')
}
if (!Array.isArray(reviewQueueParsed)) {
  throw new Error('reviewQueue.gen.ts does not export an array.')
}

console.log(`areas: ${parsed.areas.length}`)
console.log(`reviewQueue areas: ${reviewQueueParsed.length}`)
