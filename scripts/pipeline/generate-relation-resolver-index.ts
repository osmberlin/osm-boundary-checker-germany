#!/usr/bin/env bun
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { comparisonForReportSchema } from '../shared/comparisonPayload.ts'
import { DATASETS_DIRECTORY } from '../shared/datasetPaths.ts'
import { runtimeRootFromWorkspace } from '../shared/runtimeRoot.ts'
import { workspaceRootFromHere } from '../shared/workspaceRoot.ts'

type RelationResolverCandidate = {
  dataset: string
  areaId: string
  featureKey: string
  featureName: string
}

type RelationResolverIndex = {
  byRelationId: Record<string, RelationResolverCandidate[]>
}

function buildRelationResolverIndex(runtimeRoot: string): RelationResolverIndex {
  const datasetsRoot = join(runtimeRoot, DATASETS_DIRECTORY)
  const byRelationId = new Map<string, RelationResolverCandidate[]>()
  if (!existsSync(datasetsRoot)) return { byRelationId: {} }

  for (const entry of readdirSync(datasetsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue
    const area = entry.name
    const tablePath = join(datasetsRoot, area, 'output', 'comparison_table.json')
    if (!existsSync(tablePath)) continue
    try {
      const parsed = comparisonForReportSchema.parse(
        JSON.parse(readFileSync(tablePath, 'utf-8')) as unknown,
      )
      const pushCandidate = (
        osmRelationIdRaw: string,
        featureKey: string,
        featureName: string,
      ): void => {
        const relationId = Number.parseInt(osmRelationIdRaw, 10)
        if (!Number.isFinite(relationId) || relationId <= 0) return
        const relationKey = String(relationId)
        const next: RelationResolverCandidate = {
          dataset: area,
          areaId: area,
          featureKey,
          featureName,
        }
        const list = byRelationId.get(relationKey) ?? []
        if (
          !list.some(
            (existing) =>
              existing.dataset === next.dataset &&
              existing.areaId === next.areaId &&
              existing.featureKey === next.featureKey,
          )
        ) {
          list.push(next)
          byRelationId.set(relationKey, list)
        }
      }

      for (const row of parsed.rows) {
        pushCandidate(row.osmRelationId, row.canonicalMatchKey, row.nameLabel)
      }
      for (const row of parsed.unmatchedOsm) {
        pushCandidate(row.osmRelationId, row.canonicalMatchKey, row.nameLabel)
      }
    } catch {
      // ignore malformed area output file
    }
  }

  const byRelationIdObject: Record<string, RelationResolverCandidate[]> = {}
  for (const [relationId, candidates] of byRelationId.entries()) {
    byRelationIdObject[relationId] = [...candidates].sort((a, b) => {
      const datasetCmp = a.dataset.localeCompare(b.dataset, 'de')
      if (datasetCmp !== 0) return datasetCmp
      return a.featureName.localeCompare(b.featureName, 'de')
    })
  }
  return { byRelationId: byRelationIdObject }
}

function main() {
  const workspaceRoot = workspaceRootFromHere(import.meta.url)
  const runtimeRoot = runtimeRootFromWorkspace(workspaceRoot)
  const outPath = join(runtimeRoot, 'data', 'relation-resolver-index.json')
  const index = buildRelationResolverIndex(runtimeRoot)
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, `${JSON.stringify(index, null, 2)}\n`, 'utf-8')
  console.log(
    `[pipeline] wrote ${outPath} (${Object.keys(index.byRelationId).length} relation ids from ${runtimeRoot})`,
  )
}

main()
