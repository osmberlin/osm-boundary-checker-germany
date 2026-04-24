import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * WHAT: Checks refresh outputs (`report/src/data/areasIndex.gen.ts`, `report/public/datasets`, and non-empty `areas`) before artifact upload.
 * WHY: This is the contract gate for the artifact producer workflow; deploy can then assume uploaded artifacts are valid.
 * WHY (ALSO): We still keep a lightweight deploy-time check as defense in depth, because build/deploy runs can be triggered independently.
 */
type AreaIndex = {
  areas?: unknown
}

const areasIndexPath = new URL('../../report/src/data/areasIndex.gen.ts', import.meta.url)
if (!existsSync(areasIndexPath)) {
  throw new Error('Missing report/src/data/areasIndex.gen.ts after refresh.')
}

const datasetsDir = resolve('report/public/datasets')
if (!existsSync(datasetsDir)) {
  throw new Error('Missing report/public/datasets after refresh.')
}

const mod = (await import(areasIndexPath.href)) as { default?: AreaIndex }
const parsed = mod.default ?? {}
if (!Array.isArray(parsed.areas) || parsed.areas.length === 0) {
  throw new Error('areasIndex.gen.ts has no areas after refresh')
}

console.log(`areas: ${parsed.areas.length}`)
