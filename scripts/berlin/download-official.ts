#!/usr/bin/env bun
import { spawn } from 'node:child_process'
import { workspaceRootFromHere } from '../shared/workspaceRoot.ts'

function parseArgs(argv: string[]) {
  let force = false
  for (const arg of argv) {
    if (arg === '--force') force = true
  }
  return { force }
}

async function run() {
  const workspaceRoot = workspaceRootFromHere(import.meta.url)
  const { force } = parseArgs(process.argv.slice(2))
  const args = ['run', 'download:official', '--', '--area', 'berlin-bezirke']
  if (force) args.push('--force')

  const code = await new Promise<number>((resolve) => {
    const child = spawn('bun', args, {
      cwd: workspaceRoot,
      stdio: 'inherit',
      env: process.env,
    })
    child.on('close', (exitCode) => resolve(exitCode ?? 1))
    child.on('error', () => resolve(1))
  })

  process.exit(code)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
