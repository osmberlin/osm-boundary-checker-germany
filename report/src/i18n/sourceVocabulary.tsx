import { Fragment, type ReactNode } from 'react'
import type { SourceKind } from '../../../scripts/shared/sourceKind.ts'
import { Abbr } from '../components/ui/Abbr'

/**
 * Wording of the "official" side per dataset (`ComparisonForReport.sourceKind`, absent = `official`).
 * Only short visible labels live here; long explanatory texts and modals stay in `de.ts`.
 * DtP wording uses compound nouns ("DtP-Daten") so no German declension is needed.
 */
export const DTP_FULL_NAME = 'Digitize the Planet e.V.'

const vocabulary = {
  official: {
    /** KPI header, license row title, "Vergleichsdaten" row label. */
    dataHeading: 'Amtliche Daten',
    /** Heading of the filtered attribute card on the detail page. */
    dataFilteredHeading: 'Amtliche Daten (Gefiltert)',
    /** Category `official_only` (home cards, counters, table, legend). */
    onlyLabel: 'Nur amtlich',
    /** Layer area KPI on the detail page. */
    areaLabel: 'Amtliche Fläche',
    geojsonHeading: 'Amtliches GeoJSON',
    geojsonLayerTitle: 'Amtliches GeoJSON als neue Ebene (Remote Control: import)',
    openIdWithGeojson: 'In iD öffnen mit amtlicher Grenze (GeoJSON)',
    openIdWithoutGeojson: 'In iD öffnen (ohne amtliche Grenze)',
    openJosmWithGeojson: 'In JOSM öffnen mit amtlicher Grenze (GeoJSON)',
    licenseSectionHeading: 'Lizenz und OSM-Kompatibilität der amtlichen Quelle',
    /** Appended to the geometry source name: where the geometry came from. */
    geometrySourceVia: '',
  },
  dtp: {
    dataHeading: 'DtP-Daten',
    dataFilteredHeading: 'DtP-Daten (Gefiltert)',
    onlyLabel: 'Nur DtP',
    areaLabel: 'DtP-Fläche',
    geojsonHeading: 'DtP-GeoJSON',
    geojsonLayerTitle: 'DtP-GeoJSON als neue Ebene (Remote Control: import)',
    openIdWithGeojson: 'In iD öffnen mit DtP-Grenze (GeoJSON)',
    openIdWithoutGeojson: 'In iD öffnen (ohne DtP-Grenze)',
    openJosmWithGeojson: 'In JOSM öffnen mit DtP-Grenze (GeoJSON)',
    licenseSectionHeading: 'Lizenz und OSM-Kompatibilität der Quelldaten',
    geometrySourceVia: ' (über DtP)',
  },
} as const satisfies Record<SourceKind, Record<string, string>>

export type SourceTermId = keyof (typeof vocabulary)['official']

/** Plain text for `title`, `aria-label`, `<option>`, document titles and other string-only places. */
export function sourceText(kind: SourceKind | undefined, term: SourceTermId): string {
  return vocabulary[kind ?? 'official'][term]
}

const DTP_ABBR_PATTERN = /(\bDtP\b)/

/** Turns every standalone "DtP" in `text` into `<abbr title="Digitize the Planet e.V.">DtP</abbr>`. */
export function renderWithAbbr(text: string): ReactNode {
  if (!text.includes('DtP')) return text
  return text.split(DTP_ABBR_PATTERN).map((part, index) =>
    part === 'DtP' ? (
      <Abbr key={index} title={DTP_FULL_NAME}>
        {part}
      </Abbr>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    ),
  )
}

/** Vocabulary entry as a React node ("DtP" rendered as `<abbr>`). */
export function SourceTerm({ kind, term }: { kind: SourceKind | undefined; term: SourceTermId }) {
  return <>{renderWithAbbr(sourceText(kind, term))}</>
}
