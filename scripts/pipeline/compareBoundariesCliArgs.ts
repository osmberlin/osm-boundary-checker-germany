/** Per-area compare argv. Nightly (and cli/compare batches) skip per-area sync. */
export function compareBoundariesCliArgs(area: string): string[] {
  return ['scripts/compare/compare-boundaries.ts', '--area', area, '--no-sync']
}
