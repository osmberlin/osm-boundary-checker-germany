import { describe, expect, it } from 'vitest'
import { validateRelationResolverSearch } from './relationResolverSearch'

describe('validateRelationResolverSearch', () => {
  it('keeps dataset when valid', () => {
    expect(validateRelationResolverSearch({ dataset: 'berlin-bezirke' })).toEqual({
      dataset: 'berlin-bezirke',
    })
  })

  it('trims dataset and drops empty values', () => {
    expect(validateRelationResolverSearch({ dataset: '  de-gemeinden-bb  ' })).toEqual({
      dataset: 'de-gemeinden-bb',
    })
    expect(validateRelationResolverSearch({ dataset: '   ' })).toEqual({})
  })

  it('coerces finite number dataset values to string', () => {
    expect(validateRelationResolverSearch({ dataset: 123 })).toEqual({ dataset: '123' })
  })
})
