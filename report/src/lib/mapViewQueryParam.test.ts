import { describe, expect, it } from 'vitest'
import {
  parseMapViewQueryValue,
  roundMapViewForUrl,
  serializeMapViewQueryString,
} from './mapViewQueryParam'

describe('mapViewQueryParam', () => {
  it('rejects negative zoom from URL', () => {
    expect(parseMapViewQueryValue('-0.3/0/169.576855')).toBeNull()
  })

  it('clamps and rounds URL serialization values', () => {
    expect(
      serializeMapViewQueryString({
        zoom: -0.3,
        latitude: 91.1234567,
        longitude: -181.9999999,
      }),
    ).toBe('0/90/-180')
  })

  it('keeps valid values in bounds after rounding', () => {
    expect(
      roundMapViewForUrl({
        zoom: 12.345,
        latitude: 52.5200089,
        longitude: 13.4049544,
      }),
    ).toEqual({
      zoom: 12.3,
      latitude: 52.520009,
      longitude: 13.404954,
    })
  })
})
