import { spawnSync } from 'node:child_process'

/** Vector layer name inside the PMTiles archive (MapLibre `source-layer`). */
export const TIPPECANOE_LAYER = 'boundaries'

/**
 * Tippecanoe policy for **all** comparison PMTiles we emit:
 * `comparison.pmtiles`, `comparison-diff.pmtiles`, and `unmatched.pmtiles`.
 *
 * Callers only pass `{ minZoom }`; every run uses the same argv from {@link tippecanoeArgs},
 * except `--minimum-zoom`:
 * - **Overlay + unmatched:** area `compare.minZoom` (0–15). When `0`, `--minimum-zoom` is omitted (tiles from z0).
 * - **Diff-only archive:** fixed {@link TIPPECANOE_DIFF_ARCHIVE_MIN_ZOOM} (detail map / zoom hint); intentionally
 *   not tied to `compare.minZoom` so diff tiles are not generated for low zooms.
 *
 * If you add or change a flag here, update **all** archives together unless the comment above says otherwise.
 */
/** Tile coordinate detail at lower zooms (shared with overlay/diff/unmatched). */
const LOW_DETAIL_ZOOM = '9'

/** Floor for `comparison-diff.pmtiles` only (`--minimum-zoom`). Overlay/unmatched use area config. */
export const TIPPECANOE_DIFF_ARCHIVE_MIN_ZOOM = 12

const TIPPECANOE_MAX_BUFFER_BYTES = 256 * 1024 * 1024

/** Shared argv after `--layer` / optional `--minimum-zoom` (same for main, diff, unmatched). */
const TIPPECANOE_SHARED_TAIL: readonly string[] = [
  `--low-detail=${LOW_DETAIL_ZOOM}`,
  '--simplify-only-low-zooms',
  '--drop-densest-as-needed',
  '--no-simplification-of-shared-nodes',
]

export type TippecanoeRunOptions = {
  /** Passed as `--minimum-zoom` when greater than 0; see module docstring for per-archive rules. */
  minZoom: number
}

/** FlatGeobuf (`.fgb`) or GeoJSON; Felt tippecanoe infers format from the extension. */
export function tippecanoeArgs(
  inputVectorPath: string,
  outputPmtilesPath: string,
  options: TippecanoeRunOptions,
): string[] {
  const { minZoom } = options
  return [
    '--output',
    outputPmtilesPath,
    '--force',
    '--layer',
    TIPPECANOE_LAYER,
    ...(minZoom > 0 ? [`--minimum-zoom=${String(minZoom)}`] : []),
    ...TIPPECANOE_SHARED_TAIL,
    inputVectorPath,
  ]
}

export function runTippecanoe(
  inputVectorPath: string,
  outputPmtilesPath: string,
  options: TippecanoeRunOptions,
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
