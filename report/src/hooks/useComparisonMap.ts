import { useMap } from 'react-map-gl/maplibre'
import { COMPARISON_MAP_ID } from '../components/map/comparisonMapConstants'

/**
 * Map ref for the comparison map when it is rendered inside {@link ComparisonMapShell} (MapProvider + stable id).
 * Same as `useMap()[COMPARISON_MAP_ID]`; undefined until the map has mounted.
 */
export function useComparisonMap() {
  return useMap()[COMPARISON_MAP_ID]
}
