import { describe, expect, test } from 'bun:test'
import {
  deriveDatasetOsmCompatibility,
  licenseCompatibilityTableSchema,
  loadLicenseCompatibilityTable,
  resolveGeometryLicense,
} from './licenseCompatibility.ts'
import { workspaceRootFromHere } from './workspaceRoot.ts'

const baseEntry = { comment: 'x', decidedAt: '2026-10-25' }
const table = licenseCompatibilityTableSchema.parse({
  licenseRules: [
    {
      id: 'r-cc0',
      licenseName: 'CC0 1.0',
      licenseId: 'cc0_10',
      osmCompatibility: 'yes_licence',
      ...baseEntry,
    },
    {
      id: 'r-by',
      licenseName: 'CC BY 4.0',
      licenseId: 'cc_by_40',
      osmCompatibility: 'no',
      ...baseEntry,
    },
  ],
  sourceOverrides: [
    {
      id: 's-a',
      sourceName: 'Amt A',
      licenseName: 'CC BY 4.0',
      osmCompatibility: 'yes_waiver',
      evidenceUrl: 'https://example.org/e',
      ...baseEntry,
    },
  ],
})

describe('resolveGeometryLicense', () => {
  test('licence rule applies by default', () => {
    expect(resolveGeometryLicense(table, { licenseName: 'CC0 1.0', sourceName: 'Amt A' })).toEqual({
      osmCompatibility: 'yes_licence',
      licenseId: 'cc0_10',
      ruleId: 'r-cc0',
      comment: 'x',
      decidedAt: '2026-10-25',
    })
  })

  test('source override wins over licence rule only for its source and licence', () => {
    const hit = resolveGeometryLicense(table, { licenseName: 'CC BY 4.0', sourceName: 'Amt A' })
    expect(hit).toMatchObject({
      osmCompatibility: 'yes_waiver',
      ruleId: 's-a',
      licenseId: 'cc_by_40',
      evidenceUrl: 'https://example.org/e',
    })
    expect(
      resolveGeometryLicense(table, { licenseName: 'CC BY 4.0', sourceName: 'Amt B' }),
    ).toMatchObject({ osmCompatibility: 'no', ruleId: 'r-by' })
    expect(
      resolveGeometryLicense(table, { licenseName: 'CC BY 4.0', sourceName: null }),
    ).toMatchObject({ osmCompatibility: 'no', ruleId: 'r-by' })
  })

  test('unknown licence names resolve to unknown without a rule id', () => {
    expect(resolveGeometryLicense(table, { licenseName: 'Exotic', sourceName: 'Amt A' })).toEqual({
      osmCompatibility: 'unknown',
      licenseId: 'custom',
    })
    expect(resolveGeometryLicense(table, { licenseName: null, sourceName: null })).toEqual({
      osmCompatibility: 'unknown',
      licenseId: 'custom',
    })
  })
})

describe('licenseCompatibilityTableSchema', () => {
  test('rejects duplicate ids and licence names', () => {
    expect(
      licenseCompatibilityTableSchema.safeParse({
        licenseRules: [
          { id: 'a', licenseName: 'X', osmCompatibility: 'no', ...baseEntry },
          { id: 'a', licenseName: 'Y', osmCompatibility: 'no', ...baseEntry },
        ],
      }).success,
    ).toBe(false)
    expect(
      licenseCompatibilityTableSchema.safeParse({
        licenseRules: [
          { id: 'a', licenseName: 'X', osmCompatibility: 'no', ...baseEntry },
          { id: 'b', licenseName: 'X', osmCompatibility: 'no', ...baseEntry },
        ],
      }).success,
    ).toBe(false)
  })

  test('rejects partial for a single geometry', () => {
    expect(
      licenseCompatibilityTableSchema.safeParse({
        licenseRules: [{ id: 'a', licenseName: 'X', osmCompatibility: 'partial', ...baseEntry }],
      }).success,
    ).toBe(false)
  })
})

describe('deriveDatasetOsmCompatibility', () => {
  test('all, none, some, empty', () => {
    expect(deriveDatasetOsmCompatibility({ compatible: 4, total: 4 })).toBe('yes_licence')
    expect(deriveDatasetOsmCompatibility({ compatible: 0, total: 4 })).toBe('no')
    expect(deriveDatasetOsmCompatibility({ compatible: 1, total: 4 })).toBe('partial')
    expect(deriveDatasetOsmCompatibility({ compatible: 0, total: 0 })).toBe('unknown')
  })
})

describe('data/license-compatibility/dtp.json', () => {
  const workspaceRoot = workspaceRootFromHere(import.meta.url)
  const dtp = loadLicenseCompatibilityTable(workspaceRoot, 'dtp')

  test('is valid and maps the DtP licence names', () => {
    const yes = ['Deutschland Zero (CC0-DE)', 'DL-DE Zero-2.0', 'ODbL 1.0']
    const no = [
      'CC BY 4.0',
      'DL-DE BY',
      'GeoNutzV',
      'CC BY-SA 4.0',
      'otherRestriction',
      'DL-DE BY-2.0',
      'CC BY-ND 4.0',
    ]
    for (const licenseName of yes) {
      expect(resolveGeometryLicense(dtp, { licenseName, sourceName: 'X' }).osmCompatibility).toBe(
        'yes_licence',
      )
    }
    for (const licenseName of no) {
      expect(resolveGeometryLicense(dtp, { licenseName, sourceName: 'X' }).osmCompatibility).toBe(
        'no',
      )
    }
    expect(resolveGeometryLicense(dtp, { licenseName: 'Unknown', sourceName: 'X' })).toMatchObject({
      osmCompatibility: 'unknown',
    })
  })

  test('LfU Bayern CC BY 4.0 is a release', () => {
    expect(
      resolveGeometryLicense(dtp, {
        licenseName: 'CC BY 4.0',
        sourceName: 'Bayerisches Landesamt für Umwelt',
      }),
    ).toMatchObject({
      osmCompatibility: 'yes_waiver',
      evidenceUrl: 'https://wiki.openstreetmap.org/wiki/DE:Permissions',
    })
  })
})
