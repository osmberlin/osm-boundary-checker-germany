import { existsSync } from 'node:fs'
import { cp, mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { AREAS_GEN_BASENAME } from './generatedAssets.ts'

const reportRoot = import.meta.dir
const repoRoot = resolve(reportRoot, '..')
const distRoot = join(reportRoot, 'dist')
const publicRoot = join(reportRoot, 'public')

async function copyDirIfExists(src: string, dest: string): Promise<void> {
  if (!existsSync(src)) return
  await mkdir(dest, { recursive: true })
  await cp(src, dest, { recursive: true, force: true })
}

async function copyFileIfExists(src: string, dest: string): Promise<void> {
  if (!existsSync(src)) return
  await mkdir(resolve(dest, '..'), { recursive: true })
  await cp(src, dest, { recursive: false, force: true })
}

async function main() {
  await copyDirIfExists(join(publicRoot, 'datasets'), join(distRoot, 'datasets'))
  await copyDirIfExists(join(publicRoot, 'data'), join(distRoot, 'data'))
  await copyFileIfExists(join(repoRoot, AREAS_GEN_BASENAME), join(distRoot, AREAS_GEN_BASENAME))
  console.log('[bundle-static-assets] Copied datasets/data/areas index into dist')
}

void main().catch((err) => {
  console.error(err)
  process.exit(1)
})
