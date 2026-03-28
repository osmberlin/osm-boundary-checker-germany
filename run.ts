#!/usr/bin/env bun
import { spawn } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import * as p from '@clack/prompts'
import { areaHasCompareConfig } from './scripts/shared/areaConfig.ts'
import { DATASETS_DIRECTORY } from './scripts/shared/datasetPaths.ts'

function parseArgs(argv: string[]) {
  let area: string | null = null
  let all = false
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--area') {
      const v = argv[i + 1]
      if (v !== undefined) {
        area = v
        i++
      }
    }
    if (argv[i] === '--all') all = true
  }
  const ci = process.env.CI === '1' || process.env.CI === 'true'
  return { area, all, ci }
}

function discoverAreas(repoRoot: string): string[] {
  const datasetsRoot = join(repoRoot, DATASETS_DIRECTORY)
  if (!existsSync(datasetsRoot)) return []
  const out: string[] = []
  for (const name of readdirSync(datasetsRoot, { withFileTypes: true })) {
    if (!name.isDirectory()) continue
    if (name.name.startsWith('.')) continue
    if (areaHasCompareConfig(repoRoot, name.name)) out.push(name.name)
  }
  return out.sort()
}

function runCompareScript(repoRoot: string, area: string): Promise<number> {
  const script = join(repoRoot, 'scripts', 'compare', 'compare-boundaries.ts')
  return new Promise((resolve, reject) => {
    const child = spawn('bun', [script, '--area', area], {
      cwd: repoRoot,
      stdio: 'inherit',
    })
    child.on('close', (code) => resolve(code ?? 1))
    child.on('error', reject)
  })
}

async function main() {
  const repoRoot = process.cwd()
  const { area: flagArea, all: flagAll, ci } = parseArgs(process.argv.slice(2))
  const areas = discoverAreas(repoRoot)

  if (areas.length === 0) {
    console.error(
      `No folders with config.jsonc (or legacy boundary-config.json) found under ${DATASETS_DIRECTORY}/.`,
    )
    process.exit(1)
  }

  let selected: string[] = []

  if (ci) {
    selected = flagArea ? [flagArea] : areas
  } else if (flagAll) {
    selected = areas
  } else if (flagArea) {
    selected = [flagArea]
  } else {
    const choice = await p.select({
      message: 'Which area do you want to compare?',
      options: [
        { value: '__all__', label: 'All areas' },
        ...areas.map((a) => ({ value: a, label: a })),
      ],
    })
    if (p.isCancel(choice)) {
      p.cancel('Cancelled.')
      process.exit(0)
    }
    selected = choice === '__all__' ? areas : [choice as string]
  }

  let code = 0
  for (const a of selected) {
    if (!areas.includes(a)) {
      console.error(`Unknown area: ${a}`)
      process.exit(1)
    }
    const c = await runCompareScript(repoRoot, a)
    if (c !== 0) code = c
  }
  process.exit(code)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
