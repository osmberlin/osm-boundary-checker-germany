import { describe, expect, test } from 'bun:test'
import { reportRowSchema, tableRowSchema } from '../../shared/comparisonPayload.ts'
import { buildRowFlagDefinitions, evaluateRowFlags } from '../../shared/rowFlags.ts'
import type { ComparisonSourceMetadata } from '../../shared/sourceMetadata.ts'
import type { CompareRow } from './compare.ts'
import { buildOfficialLicenseOutputs } from './officialLicenses.ts'
import {
  buildStaticPayloadBase,
  comparisonRowToPayload,
  comparisonRowToTableRow,
  DTP_TABLE_ROW_SLIMMING,
  needsOfficialForEditFile,
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

describe('official-for-edit files', () => {
  const geometry: CompareRow['officialGeometryWgs84'] = { type: 'Point', coordinates: [13, 52] }
  const metricsWithLevel = (level: 'ok' | 'review' | 'issue'): CompareRow['metrics'] => ({
    iou: 1,
    areaDiffPct: 0,
    symmetricDiffPct: 0,
    hausdorffM: 0,
    officialAreaM2: 1,
    osmAreaM2: 1,
    issueIndicator: { level, reasons: [] },
  })

  test('skip rows rated ok and rows without official geometry', () => {
    const matched: CompareRow = { ...row, category: 'matched', officialGeometryWgs84: geometry }
    expect(needsOfficialForEditFile({ ...matched, metrics: metricsWithLevel('ok') })).toBe(false)
    expect(needsOfficialForEditFile({ ...matched, metrics: metricsWithLevel('review') })).toBe(true)
    expect(needsOfficialForEditFile({ ...matched, metrics: metricsWithLevel('issue') })).toBe(true)
    expect(needsOfficialForEditFile(row)).toBe(false)
  })

  test('official-only rows keep their file: they have no metrics', () => {
    expect(needsOfficialForEditFile({ ...row, officialGeometryWgs84: geometry })).toBe(true)
  })
})

describe('row flags', () => {
  const flags = [
    { id: 'managed', officialProperty: 'dtp_managed', equals: true, label: 'L', hint: 'H' },
  ]

  test('datasets without rowFlags keep rows and payload base unchanged', () => {
    expect(
      Object.keys(
        comparisonRowToPayload(row, null, undefined, evaluateRowFlags(row.officialProperties, [])),
      ),
    ).not.toContain('flags')
    expect(Object.keys(payloadBase(null))).not.toContain('rowFlags')
  })

  test('flagged rows carry flag ids in table row and shard row; definitions carry counts', () => {
    const flagged: CompareRow = { ...row, officialProperties: { name: 'X', dtp_managed: 'true' } }
    const ids = evaluateRowFlags(flagged.officialProperties, flags)
    const payloadRow = comparisonRowToPayload(flagged, null, undefined, ids)
    expect(reportRowSchema.parse(payloadRow).flags).toEqual(['managed'])
    expect(
      tableRowSchema.parse(comparisonRowToTableRow(payloadRow, DTP_TABLE_ROW_SLIMMING)).flags,
    ).toEqual(['managed'])
    expect(
      Object.keys(
        comparisonRowToPayload(
          row,
          null,
          undefined,
          evaluateRowFlags(row.officialProperties, flags),
        ),
      ),
    ).not.toContain('flags')
    const base = buildStaticPayloadBase(
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
      null,
      'official',
      buildRowFlagDefinitions(flags, [ids, []]),
    )
    expect(base.rowFlags).toEqual([{ id: 'managed', label: 'L', hint: 'H', count: 1 }])
  })
})

describe('match rules', () => {
  const matched: CompareRow = { ...row, category: 'matched' }

  test('the shard row records the rule; the table row only when the key join did not pair the row', () => {
    const byKey = comparisonRowToPayload({ ...matched, matchedBy: { rule: 0, kind: 'key' } }, null)
    expect(reportRowSchema.parse(byKey).matchedBy).toEqual({ rule: 0, kind: 'key' })
    expect(comparisonRowToTableRow(byKey)).not.toHaveProperty('matchedBy')

    const byReference = comparisonRowToPayload(
      { ...matched, matchedBy: { rule: 1, kind: 'osm_reference' } },
      null,
    )
    expect(tableRowSchema.parse(comparisonRowToTableRow(byReference)).matchedBy).toEqual({
      rule: 1,
      kind: 'osm_reference',
    })
    expect(Object.keys(comparisonRowToPayload(matched, null))).not.toContain('matchedBy')
  })

  test('the payload base embeds the ordered rules', () => {
    const matchRules = [
      { kind: 'key' as const, officialProperty: 'ars', osmTag: 'de:regionalschluessel' },
    ]
    const base = buildStaticPayloadBase(
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
      { idNormalizationPreset: 'regional-12', matchRules },
      null,
    )
    expect(base.matchRules).toEqual(matchRules)
    expect(base.idNormalizationPreset).toBe('regional-12')
  })
})
