import { mapLayerColors } from '../components/mapLayerColors'

type MapLibreExpression = unknown

/** MapLibre `circle-color` / `text-color` from feature `colorIndex` 0–9. */
export function addrPostcodeColorMatchExpression(property: 'point' | 'label'): MapLibreExpression {
  const palette = mapLayerColors.addrPostcode.palette
  const branches: unknown[] = ['match', ['get', 'colorIndex']]
  for (let i = 0; i < palette.length; i++) {
    branches.push(i, palette[i]![property])
  }
  branches.push(palette[0]![property])
  return branches
}
