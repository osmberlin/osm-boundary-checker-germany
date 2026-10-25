import { describe, expect, test } from 'vitest'
import { resolveRowLicense } from './resolveRowLicense'

const sourceMetadata = {
  official: {
    sourcePublicUrl: 'https://example.org',
    sourceDownloadUrl: 'https://example.org/data',
    licenseId: 'dl_de_zero_20' as const,
    licenseLabel: 'DL-DE-ZERO-2.0',
    licenseSourceUrl: 'https://www.govdata.de/dl-de/zero-2-0',
    osmCompatibility: 'yes_waiver' as const,
    osmCompatibilitySourceUrl: 'https://example.org/freigabe',
    osmCompatibilityComment: 'Freigabe liegt vor.',
  },
}

describe('resolveRowLicense', () => {
  test('uses the dataset licence when the row has none', () => {
    expect(resolveRowLicense({}, sourceMetadata)).toEqual({
      licenseId: 'dl_de_zero_20',
      licenseLabel: 'DL-DE-ZERO-2.0',
      licenseSourceUrl: 'https://www.govdata.de/dl-de/zero-2-0',
      osmCompatibility: 'yes_waiver',
      osmCompatibilitySourceUrl: 'https://example.org/freigabe',
      osmCompatibilityComment: 'Freigabe liegt vor.',
      isRowLicense: false,
    })
  })

  test('prefers the row licence', () => {
    const resolved = resolveRowLicense(
      {
        officialLicense: {
          licenseId: 'cc_by_40',
          licenseLabel: 'CC BY 4.0',
          osmCompatibility: 'no',
          sourceName: 'Amt A',
          ruleId: 'r-by',
          groupKey: 'Amt A|CC BY 4.0',
        },
      },
      sourceMetadata,
    )
    expect(resolved).toMatchObject({
      licenseLabel: 'CC BY 4.0',
      osmCompatibility: 'no',
      sourceName: 'Amt A',
      ruleId: 'r-by',
      isRowLicense: true,
    })
  })

  test('missing metadata resolves to unknown', () => {
    const resolved = resolveRowLicense(null, undefined)
    expect(resolved.osmCompatibility).toBe('unknown')
    expect(resolved.isRowLicense).toBe(false)
  })
})
