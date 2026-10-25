import type { OsmProfileId } from '../../../scripts/shared/osmProfiles.ts'
import { de } from '../i18n/de'

export type HomeDatasetGroupId = 'administrative' | 'postalCode' | 'protectedArea'

/** Group per OSM profile; a dataset without a profile falls back to `administrative`. */
const HOME_GROUP_BY_OSM_PROFILE: Record<OsmProfileId, HomeDatasetGroupId> = {
  admin_rs: 'administrative',
  admin_name: 'administrative',
  postal_code: 'postalCode',
  protected_area_wdpa: 'protectedArea',
}

export const HOME_GROUP_ORDER: HomeDatasetGroupId[] = [
  'administrative',
  'postalCode',
  'protectedArea',
]

/** Section heading, optional lead and `#anchor` per group (home page and its jump links). */
export const HOME_GROUPS: Record<
  HomeDatasetGroupId,
  { heading: string; lead?: string; anchor: string }
> = {
  administrative: { heading: de.home.groupAdministrativeHeading, anchor: 'verwaltungsgrenzen' },
  postalCode: { heading: de.home.groupPostalCodeHeading, anchor: 'postleitzahlen' },
  protectedArea: {
    heading: de.home.groupProtectedAreaHeading,
    lead: de.home.groupProtectedAreaLead,
    anchor: 'schutzgebiete',
  },
}

/**
 * Splits area slugs into the home page theme groups. Groups appear in `HOME_GROUP_ORDER`,
 * areas keep their input order within a group, and empty groups are left out.
 */
export function groupAreasByHomeTheme(
  areas: string[],
  osmProfileOf: (area: string) => OsmProfileId | undefined,
): { id: HomeDatasetGroupId; areas: string[] }[] {
  const byGroup = new Map<HomeDatasetGroupId, string[]>()
  for (const area of areas) {
    const profile = osmProfileOf(area)
    const groupId = profile ? HOME_GROUP_BY_OSM_PROFILE[profile] : 'administrative'
    byGroup.set(groupId, [...(byGroup.get(groupId) ?? []), area])
  }
  return HOME_GROUP_ORDER.flatMap((id) => {
    const groupAreas = byGroup.get(id)
    return groupAreas ? [{ id, areas: groupAreas }] : []
  })
}
