#!/usr/bin/env bun
import { areaConfigPathForDisplay, loadAreaConfig } from '../shared/areaConfig.ts'
import { DATASETS_DIRECTORY, datasetFolderPath } from '../shared/datasetPaths.ts'
import { parseOgcInspectSourcesFromConfig } from '../shared/ogcInspectSources.ts'
import { runtimeRootFromWorkspace } from '../shared/runtimeRoot.ts'
import { readAreaSourceMetadataFile, toComparisonSourceMetadata } from '../shared/sourceMetadata.ts'
import { workspaceRootFromHere } from '../shared/workspaceRoot.ts'
import { runCompare } from './lib/compare.ts'
import { writeOutputs } from './lib/writeOutputs.ts'

function parseArgs(argv: string[]) {
  let area: string | null = null
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--area') {
      const v = argv[i + 1]
      if (v !== undefined) {
        area = v
        i++
      }
    }
  }
  return { area }
}

function getWorkspaceRoot(): string {
  return workspaceRootFromHere(import.meta.url)
}

async function main() {
  const { area } = parseArgs(process.argv.slice(2))
  if (!area) {
    console.error('Usage: bun scripts/compare/compare-boundaries.ts --area <folder>')
    process.exit(1)
  }

  const workspaceRoot = getWorkspaceRoot()
  const runtimeRoot = runtimeRootFromWorkspace(workspaceRoot)
  let configRaw: unknown
  try {
    configRaw = loadAreaConfig(workspaceRoot, area)
  } catch (e) {
    console.error(String(e))
    console.error(`Expected ${areaConfigPathForDisplay(workspaceRoot, area)}`)
    process.exit(1)
  }

  console.log(`Comparing area: ${area}`)
  const areaPath = datasetFolderPath(runtimeRoot, area)
  const { rows, unmatchedOsm, metricsCrs } = await runCompare(runtimeRoot, area, configRaw)
  const meta = toComparisonSourceMetadata(readAreaSourceMetadataFile(areaPath))
  const ogcInspectSources = parseOgcInspectSourcesFromConfig(configRaw)
  writeOutputs(areaPath, area, rows, unmatchedOsm, metricsCrs, meta, ogcInspectSources)
  console.log(`Wrote output PMTiles + static report payloads under ${DATASETS_DIRECTORY}/${area}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
