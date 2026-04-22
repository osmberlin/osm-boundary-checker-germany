import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'

/**
 * WHAT: Rebuilds `.artifact-runtime` and copies runtime payload folders (`datasets` and optional `data`) into it.
 * WHY: Creates a stable artifact layout that downstream Pages deploy steps can consume regardless of workspace structure.
 */
const artifactRoot = path.resolve('.artifact-runtime')
rmSync(artifactRoot, { recursive: true, force: true })

const artifactDatasets = path.join(artifactRoot, 'datasets')
const artifactData = path.join(artifactRoot, 'data')
mkdirSync(artifactDatasets, { recursive: true })
mkdirSync(artifactData, { recursive: true })

cpSync(path.resolve('datasets'), artifactDatasets, { recursive: true, force: true })

const dataRoot = path.resolve('data')
if (existsSync(dataRoot)) {
  cpSync(dataRoot, artifactData, { recursive: true, force: true })
}
