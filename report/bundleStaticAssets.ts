import { existsSync } from 'node:fs'
import { cp, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const reportRoot = import.meta.dir
const distRoot = join(reportRoot, 'dist')
const publicRoot = join(reportRoot, 'public')

async function copyDirIfExists(src: string, dest: string): Promise<void> {
  if (!existsSync(src)) return
  await mkdir(dest, { recursive: true })
  await cp(src, dest, { recursive: true, force: true })
}

async function main() {
  await copyDirIfExists(join(publicRoot, 'datasets'), join(distRoot, 'datasets'))
  await copyDirIfExists(join(publicRoot, 'data'), join(distRoot, 'data'))
  console.log('[bundle-static-assets] Copied datasets/data into dist')
}

void main().catch((err) => {
  console.error(err)
  process.exit(1)
})
