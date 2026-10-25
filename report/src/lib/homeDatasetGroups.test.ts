import { describe, expect, test } from 'vitest'
import type { OsmProfileId } from '../../../scripts/shared/osmProfiles.ts'
import { groupAreasByHomeTheme } from './homeDatasetGroups'

describe('groupAreasByHomeTheme', () => {
  test('orders groups by theme and keeps the area order within a group', () => {
    const profiles: Record<string, OsmProfileId> = {
      'berlin-plz': 'postal_code',
      'de-natura2000': 'protected_area_wdpa',
      bezirke: 'admin_rs',
      'brandenburg-berlin-plz': 'postal_code',
      'de-schutzgebiete-nsg': 'protected_area_wdpa',
      gemeinden: 'admin_name',
    }
    const areas = Object.keys(profiles)
    expect(groupAreasByHomeTheme(areas, (area) => profiles[area])).toEqual([
      { id: 'administrative', areas: ['bezirke', 'gemeinden'] },
      { id: 'postalCode', areas: ['berlin-plz', 'brandenburg-berlin-plz'] },
      { id: 'protectedArea', areas: ['de-natura2000', 'de-schutzgebiete-nsg'] },
    ])
  })

  test('falls back to administrative and drops empty groups', () => {
    expect(groupAreasByHomeTheme(['a', 'b'], () => undefined)).toEqual([
      { id: 'administrative', areas: ['a', 'b'] },
    ])
    expect(groupAreasByHomeTheme([], () => undefined)).toEqual([])
  })
})
