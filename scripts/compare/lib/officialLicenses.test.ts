import { describe, expect, test } from 'bun:test'
import type { LicenseCompatibilityTable } from '../../shared/licenseCompatibility.ts'
import { buildOfficialLicenseOutputs } from './officialLicenses.ts'

const table: LicenseCompatibilityTable = {
  licenseRules: [
    {
      id: 'rule-cc0',
      licenseName: 'CC0 1.0',
      licenseId: 'cc0_10',
      osmCompatibility: 'yes_licence',
      comment: 'ok',
      decidedAt: '2026-10-25',
    },
    {
      id: 'rule-by',
      licenseName: 'CC BY 4.0',
      licenseId: 'cc_by_40',
      osmCompatibility: 'no',
      comment: 'nein',
      decidedAt: '2026-10-25',
    },
  ],
  sourceOverrides: [
    {
      id: 'src-a',
      sourceName: 'Amt A',
      licenseName: 'CC BY 4.0',
      osmCompatibility: 'yes_waiver',
      evidenceUrl: 'https://example.org/freigabe',
      comment: 'Freigabe',
      decidedAt: '2026-10-25',
    },
  ],
}

function row(key: string, props: Record<string, unknown> | null) {
  return { canonicalMatchKey: key, officialProperties: props }
}

describe('buildOfficialLicenseOutputs', () => {
  test('returns null when no row carries geometry_license_name', () => {
    expect(
      buildOfficialLicenseOutputs(
        [row('1', { name: 'a' }), row('2', { geometry_license_name: '  ' }), row('3', null)],
        table,
      ),
    ).toBeNull()
  })

  test('resolves rows, groups by source and licence, and derives dataset compatibility', () => {
    const out = buildOfficialLicenseOutputs(
      [
        row('1', {
          geometry_license_name: 'CC BY 4.0',
          geometry_source_name: 'Amt A',
          geometry_source_url: 'https://a.example',
          geometry_license_url: 'https://by.example',
        }),
        row('2', { geometry_license_name: 'CC BY 4.0', geometry_source_name: 'Amt A' }),
        row('3', { geometry_license_name: 'CC BY 4.0', geometry_source_name: 'Amt B' }),
        row('4', { geometry_license_name: 'CC0 1.0', geometry_source_name: 'Amt B' }),
        row('5', { geometry_license_name: 'Exotic', geometry_source_name: 'Amt C' }),
        row('6', null),
      ],
      table,
    )
    expect(out).not.toBeNull()
    expect(out!.byKey.size).toBe(5)
    expect(out!.byKey.get('1')).toEqual({
      licenseId: 'cc_by_40',
      licenseLabel: 'CC BY 4.0',
      licenseSourceUrl: 'https://by.example',
      osmCompatibility: 'yes_waiver',
      osmCompatibilitySourceUrl: 'https://example.org/freigabe',
      osmCompatibilityComment: 'Freigabe',
      sourceName: 'Amt A',
      sourceUrl: 'https://a.example',
      ruleId: 'src-a',
      groupKey: 'Amt A|CC BY 4.0',
    })
    expect(out!.byKey.get('3')?.osmCompatibility).toBe('no')
    expect(out!.byKey.get('5')?.osmCompatibility).toBe('unknown')
    expect(out!.byKey.get('5')?.ruleId).toBeUndefined()
    expect(out!.breakdown.map((e) => [e.groupKey, e.rowCount])).toEqual([
      ['Amt A|CC BY 4.0', 2],
      ['Amt B|CC BY 4.0', 1],
      ['Amt B|CC0 1.0', 1],
      ['Amt C|Exotic', 1],
    ])
    expect(out!.breakdown[0]!.decidedAt).toBe('2026-10-25')
    expect(out!.compatibleCount).toBe(3)
    expect(out!.totalCount).toBe(5)
    expect(out!.datasetOsmCompatibility).toBe('partial')
    expect([...out!.unknownLicenses]).toEqual([['Exotic', 1]])
  })

  test('uses unknown label and no/yes dataset values', () => {
    const none = buildOfficialLicenseOutputs(
      [row('1', { geometry_license_name: 'CC BY 4.0' }), row('2', { name: 'x' })],
      table,
    )
    expect(none!.datasetOsmCompatibility).toBe('no')
    expect(none!.byKey.get('2')).toMatchObject({
      licenseId: 'unknown',
      licenseLabel: 'unknown',
      groupKey: 'unknown|unknown',
    })
    const all = buildOfficialLicenseOutputs([row('1', { geometry_license_name: 'CC0 1.0' })], table)
    expect(all!.datasetOsmCompatibility).toBe('yes_licence')
  })
})
