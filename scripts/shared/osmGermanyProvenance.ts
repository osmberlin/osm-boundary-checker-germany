import { GERMANY_OSM_SOURCE_DEFAULTS } from './germanyOsmPbf.ts'
import {
  datasetLicenseLabelForId,
  type OsmSourceMetadataPersisted,
  type OsmSourceMetadataSide,
} from './sourceMetadata.ts'

/** Full OSM provenance for UI: `GERMANY_OSM_SOURCE_DEFAULTS` plus optional persisted timestamps. */
export function buildResolvedOsmSourceSide(
  persisted: OsmSourceMetadataPersisted | undefined | null,
): OsmSourceMetadataSide {
  const p = persisted ?? {}
  return {
    ...GERMANY_OSM_SOURCE_DEFAULTS,
    licenseLabel: datasetLicenseLabelForId(GERMANY_OSM_SOURCE_DEFAULTS.licenseId),
    downloadedAt: p.downloadedAt,
    extractedAt: p.extractedAt,
    sourceDateSource: p.sourceDateSource,
  }
}
