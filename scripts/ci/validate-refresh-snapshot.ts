import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * WHAT: Checks refresh outputs (`areas.gen.json`, `report/public/datasets`, and non-empty `areas`) before artifact upload.
 * WHY: This is the contract gate for the artifact producer workflow; deploy can then assume uploaded artifacts are valid.
 * WHY (ALSO): We still keep a lightweight deploy-time check as defense in depth, because build/deploy runs can be triggered independently.
 */
type AreaIndex = {
  areas?: unknown
}

const areasIndexPath = path.resolve('areas.gen.json')
if (!existsSync(areasIndexPath)) {
  throw new Error('Missing areas.gen.json after refresh.')
}

const datasetsDir = path.resolve('report/public/datasets')
if (!existsSync(datasetsDir)) {
  throw new Error('Missing report/public/datasets after refresh.')
}

const raw = readFileSync(areasIndexPath, 'utf8')
const parsed = JSON.parse(raw) as AreaIndex
if (!Array.isArray(parsed.areas) || parsed.areas.length === 0) {
  throw new Error('areas.gen.json has no areas after refresh')
}

console.log(`areas: ${parsed.areas.length}`)
