import { describe, expect, test } from 'vitest'
import {
  countRowsByState,
  stateFilterOptions,
  stateMaskFeatureCollection,
  validateStateSearch,
} from './stateFilter'

describe('validateStateSearch', () => {
  test('keeps a known code and drops anything else', () => {
    expect(validateStateSearch({ state: 'BB', map: 'x' })).toEqual({ state: 'BB' })
    expect(validateStateSearch({ state: 'XX' })).toEqual({})
    expect(validateStateSearch({})).toEqual({})
  })
})

test('countRowsByState counts each state of a cross-border row', () => {
  const counts = countRowsByState([{ states: ['BB'] }, { states: ['BB', 'BE'] }, {}])
  expect(Object.fromEntries(counts)).toEqual({ BB: 2, BE: 1 })
  expect(stateFilterOptions(counts).find((o) => o.code === 'BY')?.count).toBe(0)
  expect(stateFilterOptions(counts)).toHaveLength(16)
})

test('mask punches the state out of the world and fills its holes again', () => {
  const outer = [
    [13, 52],
    [14, 52],
    [14, 53],
    [13, 53],
    [13, 52],
  ]
  const hole = [
    [13.3, 52.4],
    [13.6, 52.4],
    [13.6, 52.6],
    [13.3, 52.4],
  ]
  const mask = stateMaskFeatureCollection({
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [outer, hole] },
  })
  expect(mask.features).toHaveLength(2)
  expect(mask.features[0]?.geometry.coordinates[1]).toEqual(outer)
  expect(mask.features[1]?.geometry.coordinates).toEqual([hole])
})
