/** IoU = intersection area / union area (Jaccard index for the two regions). */
export function computeIou(intersectionAreaM2: number, unionAreaM2: number): number {
  return unionAreaM2 > 0 ? intersectionAreaM2 / unionAreaM2 : 0
}
