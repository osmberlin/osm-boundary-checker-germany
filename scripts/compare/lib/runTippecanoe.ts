import { spawnSync } from 'node:child_process'

/** Vector layer name inside the PMTiles archive (MapLibre `source-layer`). */
export const TIPPECANOE_LAYER = 'boundaries'

/**
 * User-facing map policy:
 * - geometry may be simplified below z15
 * - z10 should keep roughly sub-kilometer fidelity (target: ~500 m in Germany)
 * - z15 should preserve full geometry detail
 */
const MAX_ZOOM = '15'
const FULL_DETAIL_ZOOM = '15'
const LOW_DETAIL_ZOOM = '11'
const SIMPLIFICATION_FACTOR = '4'
const FAST_LOW_ZOOM_DETAIL = '9'
const FAST_LOW_ZOOM_SIMPLIFICATION_FACTOR = SIMPLIFICATION_FACTOR
const TIPPECANOE_MAX_BUFFER_BYTES = 256 * 1024 * 1024

export type TippecanoeProfile = 'default' | 'fast_low_zoom'

/**
 * argv passed to `tippecanoe` (after the executable name).
 * Documented in README; tune topology vs file size here.
 */
/** FlatGeobuf (`.fgb`) or GeoJSON; Felt tippecanoe infers format from the extension. */
export function tippecanoeArgs(
  inputVectorPath: string,
  outputPmtilesPath: string,
  profile: TippecanoeProfile = 'default',
): string[] {
  const lowDetail = profile === 'fast_low_zoom' ? FAST_LOW_ZOOM_DETAIL : LOW_DETAIL_ZOOM
  const simplification =
    profile === 'fast_low_zoom' ? FAST_LOW_ZOOM_SIMPLIFICATION_FACTOR : SIMPLIFICATION_FACTOR
  const args = [
    '--output',
    outputPmtilesPath,
    '--force',
    '--layer',
    TIPPECANOE_LAYER,
    `--maximum-zoom=${MAX_ZOOM}`,
    `--full-detail=${FULL_DETAIL_ZOOM}`,
    `--low-detail=${lowDetail}`,
    `--simplification=${simplification}`,
    '--drop-densest-as-needed',
    inputVectorPath,
  ]
  // Keep adjacent polygons aligned after simplification (fewer seams/gaps).
  // This is expensive on very large nationwide overlays, so the fast profile
  // disables it and instead prioritizes render throughput for low zooms.
  if (profile === 'default') args.splice(args.length - 2, 0, '--detect-shared-borders')
  return args
}

export function runTippecanoe(
  inputVectorPath: string,
  outputPmtilesPath: string,
  profile: TippecanoeProfile = 'default',
): { stderr: string; stdout: string } {
  const args = tippecanoeArgs(inputVectorPath, outputPmtilesPath, profile)
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
