import type maplibregl from 'maplibre-gl'
import { mapLayerColors } from '../mapLayerColors'

export const OSM_UNMATCHED_OVERLAY_STRIPE_PATTERN_ID =
  'comparison-osm-unmatched-overlay-diagonal-stripes'

function parseHexColor(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '')
  if (normalized.length !== 6) return [234, 88, 12]
  const red = Number.parseInt(normalized.slice(0, 2), 16)
  const green = Number.parseInt(normalized.slice(2, 4), 16)
  const blue = Number.parseInt(normalized.slice(4, 6), 16)
  if ([red, green, blue].some((channel) => Number.isNaN(channel))) return [234, 88, 12]
  return [red, green, blue]
}

function addStripePatternIfMissing(map: maplibregl.Map, patternId: string, colorHex: string): void {
  if (map.hasImage(patternId)) return
  const [red, green, blue] = parseHexColor(colorHex)
  const size = 12
  const stripeWidth = 6
  const pixels = new Uint8Array(size * size * 4)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const pixelOffset = (y * size + x) * 4
      // Stripe direction: bottom-left -> top-right.
      const diagonal = (x + y) % size
      const inStripe = diagonal < stripeWidth

      if (!inStripe) continue
      pixels[pixelOffset] = red
      pixels[pixelOffset + 1] = green
      pixels[pixelOffset + 2] = blue
      pixels[pixelOffset + 3] = 220
    }
  }

  map.addImage(patternId, { width: size, height: size, data: pixels }, { pixelRatio: 1 })
}

export function ensureComparisonMapSprites(map: maplibregl.Map): void {
  addStripePatternIfMissing(
    map,
    OSM_UNMATCHED_OVERLAY_STRIPE_PATTERN_ID,
    mapLayerColors.osmUnmatched.fill,
  )
}
