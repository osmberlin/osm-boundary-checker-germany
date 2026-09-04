import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArsSuccessorTable, type ArsSuccessorTable } from './arsSuccessorTable.ts'

export function arsSuccessorsJsonPath() {
  return join(dirname(fileURLToPath(import.meta.url)), 'arsSuccessors.json')
}

let cachedTable: ArsSuccessorTable | undefined

export function loadArsSuccessorTable(path = arsSuccessorsJsonPath()) {
  if (cachedTable && path === arsSuccessorsJsonPath()) return cachedTable
  if (!existsSync(path)) {
    throw new Error(`Missing ARS successor table at ${path}`)
  }
  const raw: unknown = JSON.parse(readFileSync(path, 'utf-8'))
  const parsed = parseArsSuccessorTable(raw)
  if (path === arsSuccessorsJsonPath()) cachedTable = parsed
  return parsed
}
