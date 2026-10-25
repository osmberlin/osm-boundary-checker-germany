import { describe, expect, test } from 'bun:test'
import { reportRowSchema, tableRowSchema } from '../../shared/comparisonPayload.ts'
import type { ComparisonSourceMetadata } from '../../shared/sourceMetadata.ts'
import type { CompareRow } from './compare.ts'
import { buildOfficialLicenseOutputs } from './officialLicenses.ts'
import {
  buildStaticPayloadBase,
  comparisonRowToPayload,
  comparisonRowToTableRow,
  DTP_TABLE_ROW_SLIMMING,
} from './writeOutputs.ts'

const sourceMetadata: ComparisonSourceMetadata = {
  official: {
    sourcePublicUrl: 'https://example.org/',
    sourceDownloadUrl: 'https://example.org/data',
    licenseId: 'dl_de_zero_20',
    licenseLabel: 'DL-DE-ZERO-2.0',
    osmCompatibility: 'yes_waiver',
  },
  osm: {},
}

const row: CompareRow = {
  canonicalMatchKey: '11000000',
  nameLabel: 'Berlin',
  category: 'official_only',
  osmRelationId: '',
  metrics: null,
  officialGeometryWgs84: null,
  osmGeometryWgs84: null,
  officialProperties: { name: 'Berlin' },
  osmProperties: null,
}

function payloadBase(officialLicenses: ReturnType<typeof buildOfficialLicenseOutputs>) {
  return buildStaticPayloadBase(
    'area',
    'Area',
    'Gebiet',
    '2026-01-01T00:00:00.000Z',
    'EPSG:25832',
    'administrative',
    false,
    false,
    sourceMetadata,
    { officialMatchProperty: 'ars', bboxFilter: 'none', osmScopeFilter: 'none', minZoom: 0 },
    [],
    null,
    officialLicenses,
  )
}

describe('datasets without per-geometry licences', () => {
  test('row payload and source metadata carry no licence additions', () => {
    const payloadRow = comparisonRowToPayload(row, null)
    expect(Object.keys(payloadRow)).not.toContain('officialLicense')
    const base = payloadBase(null)
    expect(base.sourceMetadata).toEqual({ official: sourceMetadata.official, osm: {} })
    expect(Object.keys(base.sourceMetadata)).toEqual(['official', 'osm'])
    expect(base.sourceMetadata.official.osmCompatibility).toBe('yes_waiver')
  })

  test('builder returns null for rows without geometry_license_name', () => {
    expect(buildOfficialLicenseOutputs([row], { licenseRules: [], sourceOverrides: [] })).toBeNull()
  })
})

describe('datasets with per-geometry licences', () => {
  test('row gets officialLicense and dataset gets derived compatibility and breakdown', () => {
    const licenseRow: CompareRow = {
      ...row,
      officialProperties: { geometry_license_name: 'CC0 1.0', geometry_source_name: 'Amt' },
    }
    const outputs = buildOfficialLicenseOutputs([licenseRow], {
      licenseRules: [
        {
          id: 'r',
          licenseName: 'CC0 1.0',
          licenseId: 'cc0_10',
          osmCompatibility: 'yes_licence',
          comment: 'ok',
          decidedAt: '2026-10-25',
        },
      ],
      sourceOverrides: [],
    })!
    const payloadRow = comparisonRowToPayload(licenseRow, null, outputs.byKey.get('11000000'))
    expect(reportRowSchema.parse(payloadRow).officialLicense?.groupKey).toBe('Amt|CC0 1.0')
    const tableRow = tableRowSchema.parse(
      comparisonRowToTableRow(
        comparisonRowToPayload(
          {
            ...licenseRow,
            officialProperties: {
              ...licenseRow.officialProperties,
              name: 'Berlin',
              wdpa: '1',
              category_id: 2,
              category_name: 'NSG',
              dtp_url: 'https://example.org/x',
            },
          },
          null,
          outputs.byKey.get('11000000'),
        ),
        DTP_TABLE_ROW_SLIMMING,
      ),
    )
    expect(Object.keys(tableRow)).not.toContain('officialLicense')
    expect(Object.keys(tableRow)).not.toContain('licenseGroupId')
    expect(tableRow.officialProperties).toBeNull()
    expect(tableRow.osmProperties).toBeNull()
    const base = payloadBase(outputs)
    expect(base.sourceMetadata.official.osmCompatibility).toBe('yes_licence')
    expect(base.sourceMetadata.licenseBreakdown).toHaveLength(1)
  })
})
