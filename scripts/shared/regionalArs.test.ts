import { describe, expect, test } from 'bun:test'
import { classifyRegionalArsLevel, geometryFeatureForArs } from './regionalArs.ts'

const gemeindenByArs = {
  '097720207207': 'Gablingen',
  '097725707001': 'Beispielgemeinde in Verband',
}

describe('classifyRegionalArsLevel', () => {
  test('classifies by the last non-zero ARS part', () => {
    expect(classifyRegionalArsLevel('090000000000')).toBe('land')
    expect(classifyRegionalArsLevel('097720000000')).toBe('kreis')
    expect(classifyRegionalArsLevel('097725707000')).toBe('verband')
    expect(classifyRegionalArsLevel('097720207207')).toBe('gemeinde')
  })
})

describe('geometryFeatureForArs', () => {
  test('points Land, Kreis and Gemeinde keys at their own dataset', () => {
    expect(geometryFeatureForArs('090000000000', gemeindenByArs)).toEqual({
      areaId: 'de-laender',
      featureKey: '090000000000',
    })
    expect(geometryFeatureForArs('097720000000', gemeindenByArs)).toEqual({
      areaId: 'de-landkreise',
      featureKey: '097720000000',
    })
    expect(geometryFeatureForArs('097720207207', gemeindenByArs)).toEqual({
      areaId: 'de-gemeinden-by',
      featureKey: '097720207207',
    })
  })

  test('points a real Verband at the Verwaltungsgemeinschaften dataset', () => {
    expect(geometryFeatureForArs('097725707000', gemeindenByArs)).toEqual({
      areaId: 'de-verwaltungsgemeinschaften',
      featureKey: '097725707000',
    })
  })

  test('points a pseudo-Verband at the Gemeinde it stands in for', () => {
    expect(geometryFeatureForArs('097720207000', gemeindenByArs)).toEqual({
      areaId: 'de-gemeinden-by',
      featureKey: '097720207207',
    })
  })

  test('keeps a Verband with a leading zero when no matching Gemeinde exists', () => {
    expect(geometryFeatureForArs('071310900000', gemeindenByArs)).toEqual({
      areaId: 'de-verwaltungsgemeinschaften',
      featureKey: '071310900000',
    })
  })

  test('returns null for an unknown Land prefix', () => {
    expect(geometryFeatureForArs('990000207207', {})).toBeNull()
  })
})
