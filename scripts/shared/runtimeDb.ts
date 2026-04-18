import { Database } from 'bun:sqlite'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const RUNTIME_DATA_DIR = 'data'
const RUNTIME_DB_BASENAME = 'runtime.sqlite'
const SCHEMA_PATH = join('docs', 'sqlite-runtime-schema.sql')

export function runtimeDbPath(runtimeRoot: string): string {
  return join(runtimeRoot, RUNTIME_DATA_DIR, RUNTIME_DB_BASENAME)
}

export function openRuntimeDatabase(runtimeRoot: string, readonly = false): Database {
  const dbPath = runtimeDbPath(runtimeRoot)
  return new Database(dbPath, { create: !readonly, readonly })
}

export function ensureRuntimeDatabase(runtimeRoot: string, workspaceRoot: string): Database {
  const dbPath = runtimeDbPath(runtimeRoot)
  const dataDir = join(runtimeRoot, RUNTIME_DATA_DIR)
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true })
  const db = new Database(dbPath, { create: true, readonly: false })
  const schemaSql = readFileSync(join(workspaceRoot, SCHEMA_PATH), 'utf-8')
  db.exec(schemaSql)
  return db
}
