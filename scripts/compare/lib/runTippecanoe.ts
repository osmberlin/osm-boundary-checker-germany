import { spawnSync } from 'node:child_process'

/** Vector layer name inside the PMTiles archive (MapLibre `source-layer`). */
export const TIPPECANOE_LAYER = 'boundaries'

/**
 * User-facing map policy:
 * - Lower zooms: coarser tile coordinate precision (`--low-detail`) and normal simplification.
 * - Deepest generated zoom: no line/polygon simplification (`--simplify-only-low-zooms`).
 * - Above deepest generated zoom: rely on renderer overzoom.
 */
/** Tile coordinate detail at lower zooms (default full-detail stays at tippecanoe default). */
const LOW_DETAIL_ZOOM = '9'
const TIPPECANOE_MAX_BUFFER_BYTES = 256 * 1024 * 1024

/** FlatGeobuf (`.fgb`) or GeoJSON; Felt tippecanoe infers format from the extension.
 * @param options.minZoom Area `compare.minZoom` (0–15). When `0`, `--minimum-zoom` is omitted (tiles from z0).
 */
export function tippecanoeArgs(
  inputVectorPath: string,
  outputPmtilesPath: string,
  options: { minZoom: number },
): string[] {
  const { minZoom } = options
  const args = [
    '--output',
    outputPmtilesPath,
    '--force',
    '--layer',
    TIPPECANOE_LAYER,
    ...(minZoom > 0 ? [`--minimum-zoom=${String(minZoom)}`] : []),
    `--low-detail=${LOW_DETAIL_ZOOM}`,
    '--simplify-only-low-zooms',
    '--drop-densest-as-needed',
    '--no-simplification-of-shared-nodes',
    inputVectorPath,
  ]
  return args
}

export function runTippecanoe(
  inputVectorPath: string,
  outputPmtilesPath: string,
  options: { minZoom: number },
): { stderr: string; stdout: string } {
  const args = tippecanoeArgs(inputVectorPath, outputPmtilesPath, options)
  const r = spawnSync('tippecanoe', args, {
    encoding: 'utf-8',
    maxBuffer: TIPPECANOE_MAX_BUFFER_BYTES,
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
