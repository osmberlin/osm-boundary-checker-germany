import { spawnSync } from 'node:child_process'

/** Vector layer name inside the PMTiles archive (MapLibre `source-layer`). */
export const TIPPECANOE_LAYER = 'boundaries'

/** Max zoom kept at full detail — align with typical report map zoom. */
const FULL_DETAIL_ZOOM = '14'

/**
 * argv passed to `tippecanoe` (after the executable name).
 * Documented in README; tune topology vs file size here.
 */
/** FlatGeobuf (`.fgb`) or GeoJSON; Felt tippecanoe infers format from the extension. */
export function tippecanoeArgs(inputVectorPath: string, outputPmtilesPath: string): string[] {
  return [
    '--output',
    outputPmtilesPath,
    '--force',
    '--layer',
    TIPPECANOE_LAYER,
    '--no-simplification-of-shared-nodes',
    '--no-line-simplification',
    '--no-tiny-polygon-reduction',
    `--full-detail=${FULL_DETAIL_ZOOM}`,
    inputVectorPath,
  ]
}

export function runTippecanoe(
  inputVectorPath: string,
  outputPmtilesPath: string,
): { stderr: string; stdout: string } {
  const args = tippecanoeArgs(inputVectorPath, outputPmtilesPath)
  const r = spawnSync('tippecanoe', args, {
    encoding: 'utf-8',
    maxBuffer: 20 * 1024 * 1024,
  })
  if (r.error) {
    throw new Error(
      `tippecanoe could not be started (${r.error.message}). Install tippecanoe (e.g. brew install tippecanoe) and ensure it is on PATH.`,
    )
  }
  if (r.status !== 0) {
    throw new Error(
      `tippecanoe failed (exit ${r.status}): ${r.stderr || r.stdout || '(no output)'}`,
    )
  }
  return { stderr: r.stderr ?? '', stdout: r.stdout ?? '' }
}
