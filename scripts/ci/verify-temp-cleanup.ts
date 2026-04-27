#!/usr/bin/env bun
import { existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const roots = [resolve('.cache'), resolve('datasets')]
const forbiddenFragments = ['.tmp-', '.old-']
const forbiddenSuffixes = ['.tmp']

function scanDir(dir: string, out: string[]): void {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name)
    const rel = abs.replace(`${process.cwd()}/`, '')
    if (
      forbiddenFragments.some((fragment) => entry.name.includes(fragment)) ||
      forbiddenSuffixes.some((suffix) => entry.name.endsWith(suffix))
    ) {
      out.push(rel)
    }
    if (entry.isDirectory()) scanDir(abs, out)
  }
}

const leftovers: string[] = []
for (const root of roots) scanDir(root, leftovers)

if (leftovers.length > 0) {
  console.error('[cleanup] Found leftover temporary files/directories:')
  for (const item of leftovers.sort()) console.error(` - ${item}`)
  process.exit(1)
}

console.log('[cleanup] No temporary leftovers detected.')
