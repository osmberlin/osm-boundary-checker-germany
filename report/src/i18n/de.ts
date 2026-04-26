import { meanIouChartDe } from '@compare-metrics/modalCopyDe.ts'
import type { ReportRow } from '../types/report'

/** UI copy (German). Metric modal copy lives in scripts/compare/lib/metrics/ (per-metric folder, de.ts). */
export const de = {
  appTitle: 'OSM-Grenzabgleich',

  breadcrumb: {
    navLabel: 'Brotkrumen-Navigation',
    home: 'Startseite',
  },

  footer: {
    geoDataLine: 'Geodaten: ',
    osmLinkHref: 'https://www.openstreetmap.org/copyright',
    osmLinkLabel: 'OpenStreetMap',
    geoDataBetween: ' und ',
    bkgLinkHref: 'https://www.bkg.bund.de/',
    bkgLinkLabel: 'Bundesamt für Kartographie und Geodäsie (VG250 u. a.)',
    geoDataSuffix: '.',
    openSourceComponentsLine: 'Open-Source-Komponenten: ',
    openSourceThanks: [
      { name: 'React', href: 'https://react.dev/' },
      { name: 'TanStack Router', href: 'https://tanstack.com/router' },
      { name: 'Vite', href: 'https://vite.dev/' },
      { name: 'MapLibre GL', href: 'https://maplibre.org/' },
      { name: 'PMTiles', href: 'https://github.com/protomaps/PMTiles' },
      { name: 'Recharts', href: 'https://recharts.org/' },
      { name: 'Tippecanoe', href: 'https://github.com/felt/tippecanoe' },
      { name: 'osmium-tool', href: 'https://osmcode.org/osmium-tool/' },
      { name: 'GDAL/OGR', href: 'https://gdal.org/' },
    ],
  },

  /** In-page block: data freshness, source URLs, OSM pipeline (not the global AppFooter). */
  provenance: {
    sectionAria: 'Datenstand, Quellen und Filterung',
    title: 'Datenstand und Quellen',
    reportCreatedLabel: 'Auswertung erstellt',
    officialDownloadLabel: 'Amtliche Geometrien (Download/Stand)',
    officialSourceUpdatedLabel: 'Amtliche Quelle aktualisiert',
    officialSourcePublishedLabel: 'Amtliche Quelle veröffentlicht',
    osmDownloadLabel: 'OSM-Geometrien (Download/Stand)',
    officialHeading: 'Amtliche Daten',
    officialLead:
      'Die Vergleichsgeometrie auf der amtlichen Seite stammt aus den je nach Gebiet konfigurierten Quellen — z. B. BKG VG25 (Skript bkg:extract) oder ein Landes-WFS. Steht eine URL in den Metadaten, ist sie unten verlinkt.',
    officialMetaPrefix: 'Hinterlegt',
    sourceLinkLabel: 'Quelle (extern)',
    sourcePublicLinkLabel: 'Link (Webseite)',
    sourceDownloadLinkLabel: 'Link (Download)',
    licenseLabel: 'Lizenz',
    licenseSectionHeading: 'Lizenz und OSM-Kompatibilitaet der amtlichen Quelle',
    licenseShortNameLabel: 'Originale Lizenz (Kurzname)',
    licenseSourceLabel: 'Lizenzquelle',
    osmCompatibilityLabelTitle: 'OSM-kompatibel',
    osmCompatibilitySourceLabel: 'Kompatibilitaetsnachweis',
    unknown: 'Unbekannt',
    osmCompatibilityLabel: {
      unknown: 'Unbekannt',
      no: 'Nein',
      yes_licence: 'Ja (Lizenz oder Freigabe)',
      yes_waiver: 'Ja (Lizenz oder Freigabe)',
    },
    osmHeading: 'OpenStreetMap',
    osmLead:
      'Die OSM-Geometrien werden aus einem Geofabrik-Länder-Extract gewonnen (üblicherweise Germany), lokal zwischengespeichert und anschließend gefiltert.',
    osmFilterTitle: 'Filterung (OSM)',
    osmFilterBody:
      'Zuerst schränkt osmium tags-filter die PBF typischerweise auf Grenzobjekte ein (z. B. administrative Grenzen oder PLZ-Grenzen). Danach wählt ogr2ogr auf dem GDAL-Layer multipolygons mit einer gebietsspezifischen Bedingung (ogrWhere oder -sql in config.jsonc) die Zielobjekte aus. Der Compare-Lauf nutzt danach pro Datensatz explizit konfigurierte Scope-Regeln (`compare.bboxFilter` und `compare.osmScopeFilter`). Dadurch zählen „Nur OSM“-Treffer nur dann, wenn sie im konfigurierten räumlichen Vergleichsbereich liegen.',
    osmFilterNoteTitle: 'Konkrete Zusammenfassung aus dem Build',
  },

  home: {
    processingStatusLink: 'Verarbeitungsstatus öffnen',
    introP1:
      'Diese Anwendung vergleicht amtliche Grenzdaten mit OpenStreetMap (OSM). Ein nächtlicher Lauf (einmal pro Tag) bezieht die OSM-Daten des Vortags und stellt sie den jeweiligen amtlichen Geometrien gegenüber.',
    introP2:
      'Die Auswertung zeigt, wo OSM-Objekte den amtlichen Referenzen zugeordnet werden können oder nicht — etwa wegen Tagging — und wo sich Grenzverläufe zwischen beiden Datensätzen unterscheiden, mit mehreren Kennzahlen dargestellt. So findest du Tagging- und geometrische Abweichungen. Schaltflächen zur Bearbeitung öffnen die Referenzgrenze, damit du die OSM-Daten manuell anpassen kannst.',
    leadBefore: 'Gebiet wählen. Die Auswertung wird aus dem Ordner',
    leadAfter: 'des jeweiligen Gebiets gelesen (zuerst den Vergleich ausführen).',
    noAreas:
      'Keine Gebiete mit output/comparison_table.json unter datasets/ gefunden. Vergleich ausführen (bun run compare).',
    /** Home list: per-area row of category counts. */
    categoryStatsAria: 'Zugeordnet, nur amtlich, OSM ohne Treffer in offiziellen Daten — Anzahl',
    unmatchedStat: 'Nur OSM',
    unmatchedLink: 'Liste: OSM ohne Treffer im amtlichen Export',
  },

  status: {
    breadcrumb: 'Verarbeitungsstatus',
    title: 'Verarbeitungsstatus',
    backHome: '← Zurück zur Startseite',
    inProgressLabel: 'Lauf aktiv',
    inProgressYes: 'Ja',
    inProgressNo: 'Nein',
    currentPhase: 'Aktuelle Phase',
    currentRun: 'Aktuelle Lauf-ID',
    noRuns: 'Noch keine Läufe protokolliert.',
    runId: 'Lauf-ID',
    started: 'Start',
    ended: 'Ende',
    duration: 'Dauer',
    result: 'Ergebnis',
    downloadAndSteps: 'Download- und Prozessschritte',
    datasets: 'Datensätze',
  },

  areaReport: {
    backAreas: '← Gebiete',
    chartTitle: meanIouChartDe.chartTitle,
    /** Freshness block heading (line 1). */
    freshnessHeadingReport: 'Auswertung',
    freshnessHeadingOfficial: 'Amtliche Daten',
    freshnessHeadingOsm: 'OSM Daten',
    freshnessSecondaryDownloadedPrefix: 'Download',
    sourceDateUnknown: 'kein Datum hinterlegt',
    loading: 'Laden…',
    errorRunCompare: 'Vergleich im Projekt ausführen, damit',
    errorRunCompareExists: 'vorliegt.',
    table: {
      name: 'Name',
      key: 'Schlüssel',
      category: 'Kategorie',
      iou: 'IoU',
      areaDelta: 'Δ Fläche %',
      hausdorff: 'Hausdorff',
      map: 'Karte',
      view: 'Detail',
    },
    chartTooltipIou: meanIouChartDe.chartTooltipIou,
    unmatchedCountLabel: 'OSM ohne Treffer in offiziellen Daten (gesamt)',
    stats: {
      summaryRowAria: 'Auswertungszeit und Quelldaten, Kategorien für Tabelle und Karte',
      /** Row 1: Auswertung, amtliche und OSM-Quelle — jeweils Alter und Zeitpunkt. */
      summaryStatRowAria: 'Statistik: Alter und Zeitpunkt der Auswertung sowie der Quelldaten',
      /** Row 2: Legende mit Kategoriezahlen und Filter für Tabelle und Karte. */
      summaryLegendRowAria: 'Legende: Zugeordnet, nur amtlich, nur OSM — Anzahl und Sichtbarkeit',
      categoryToggleRowAria: 'Kategorien für Tabelle und Karte',
      mapNoVisibleCategories: 'Keine Kategorie ausgewählt — mindestens eine aktivieren.',
      mapLoading: 'Karte wird geladen …',
    },
  },

  feature: {
    back: '← Zurück zur Tabelle',
    loading: 'Laden…',
    notFound: 'Objekt nicht gefunden.',
    loadingMap: 'Karte wird geladen …',
    osmRelation: 'OSM-Relation',
    stats: {
      iou: 'IoU',
      areaDelta: 'Flächenabweichung',
      symDiff: 'Symmetrische Differenz',
      hausdorff: 'Hausdorff-Abstand',
      areaOfficial: 'Amtliche Fläche',
      areaOsm: 'OSM-Fläche',
      diffMetricsRowAria: 'Differenz-Kennzahlen',
      layersRowAria: 'Flächen und Kartenebenen',
      /** Below map: CRS line for projected metrics. */
      footnote: {
        /** Shown below the feature map when metrics exist. */
        metricsCrsLine: (crs: string) => `Projiziertes Metrik-Koordinatensystem: ${crs}`,
      },
    },
    noMetrics: 'Keine Überlappungsmetriken (auf einer Seite fehlt die Geometrie).',
    noPmtiles:
      'Kein Kachel-Archiv (comparison.pmtiles) vorhanden — Vergleich mit Geometrien ausführen (tippecanoe erforderlich).',
    liveSourcesSectionAria: 'Live-Attribute von amtlichen Diensten und OSM',
    liveSourcesSectionTitle: 'Quellenattribute abfragen',
    liveSourcesSectionLead:
      'WFS: konfigurierte amtliche Dienste für den Kartenausschnitt (Bounding Box aus dem Vergleich, leicht gepuffert). OSM: optionale Overpass-Abfrage für alle `boundary=*`-Relationen und -Ways passend zum Datensatz in genau diesem Kasten — ohne weitere Tag-Filter, zum manuellen Abgleich.',
    liveOfficialHeading: 'Amtliche Quelle (WFS)',
    liveOfficialLoad: 'Eigenschaften laden',
    liveOfficialLoading: 'Wird geladen …',
    liveOfficialNoBbox: 'Kein Kartenausschnitt — für dieses Objekt liegt keine Geometrie vor.',
    liveOfficialEmpty: 'Keine Treffer im Ausschnitt.',
    liveOfficialInvalidJson: 'Unerwartete WFS-Antwort (kein FeatureCollection).',
    liveOfficialHttp: 'WFS-Anfrage fehlgeschlagen:',
    liveOfficialFeatureTitle: (index1: number, id: string) =>
      `Datensatz ${index1}${id ? ` · ${id}` : ''}`,
    liveOsmHeading: 'OpenStreetMap (Overpass)',
    liveOsmLoad: 'OSM-Grenzen im Ausschnitt laden …',
    liveOsmOverpassWarnTitle: 'Overpass-Anfrage',
    liveOsmOverpassWarnLead:
      'Es wird eine echte Anfrage an die öffentliche Overpass-API gesendet (Last für die Server, Timeout möglich).',
    liveOsmOverpassWarnScope:
      'Nur für kleine Kartenausschnitte nutzen — nicht für Bundesland- oder Deutschland-Ebene.',
    liveOsmServerLabel: 'Overpass-Server',
    liveOsmOverpassWarnQuery: 'Overpass-Abfrage (bearbeitbar):',
    liveOsmQueryReset: 'Standardabfrage wiederherstellen',
    liveOsmConfirmNo: 'Abbrechen',
    liveOsmConfirmYes: 'Ja, Overpass-Anfrage senden',
    liveOsmLastErrorTitle: 'Overpass-Fehler',
    liveOsmLastErrorHint:
      'Server oder Abfrage anpassen und erneut senden — oder „Abbrechen“ und den Dialog schließen.',
    liveOsmAgain: 'Neue Overpass-Abfrage',
    liveOsmLoading: 'Overpass antwortet …',
    liveOsmEmpty: 'Keine Treffer (`boundary=*` passend zum Datensatz in diesem Kasten).',
    liveOsmHitNoTags: '(keine Tags)',
    liveOsmInvalidJson: 'Unerwartete Overpass-Antwort.',
    liveOsmHttp: 'Overpass-Anfrage fehlgeschlagen:',
    liveOsmHitTitle: (osmType: string, id: number) => `${osmType} ${id}`,

    datasetPropertiesSectionAria: 'Attribute aus dem Vergleich (amtlich und OSM)',
    datasetPropertiesSectionTitle: 'Attribute aus dem Vergleich',
    datasetPropertiesSectionLead:
      'Eigenschaften der zusammengeführten GeoJSON-Objekte zum Zeitpunkt des letzten Vergleichs — ohne Live-Abfrage.',
    datasetOfficialCardTitle: 'Amtliche Daten',
    datasetOsmCardTitle: 'OSM-Daten',
    datasetOsmOpenHistory: 'Auf osm.org anzeigen',
    datasetPropertiesEmpty: '—',
    datasetPropertiesLegacySnapshot:
      'Für diesen Snapshot sind keine gespeicherten Attribute verfügbar — Vergleich erneut ausführen.',

    updateMap: {
      title: 'Daten in OSM bearbeiten',
      lead: 'Amtliche Referenzgeometrie als GeoJSON sowie Direktlinks zu iD und JOSM — für Abgleich und Korrektur der OSM-Grenze.',
      idHeading: 'iD (im Browser)',
      josmHeading: 'JOSM (Remote Control)',
      downloadOfficial: 'Amtliches Polygon laden (GeoJSON)',
      downloadOfficialDisabledHint:
        'Kein amtlicher GeoJSON-Export für diese Zeile (z. B. nur OSM, keine amtliche Geometrie oder Snapshot ohne Dateien).',
      downloadOfficialHint:
        'Datei enthält u. a. Namen, Schlüssel und `officialSource` (Anbieter, Datensatz, URL, …), sofern beim Vergleich hinterlegt.',
      opensInNewWindowTitle: 'Öffnet in einem neuen Browser-Tab',
      openId: 'In iD öffnen',
      openIdWithOverlay:
        'Referenz als Hintergrund-Track, zugleich viele Kartendetails ausgeblendet (Grenzen, Wasser, Hauptstraßen sichtbar)',
      openIdRelationOnly:
        'Kartenausschnitt und Relation; ohne Referenz-Overlay (kein amtliches Polygon in dieser Zeile / kein Export)',
      idDisableFeaturesHint:
        'In iD werden u. a. Gebäude, Wege und Bahn usw. ausgeblendet; Grenzen, Gewässer und übergeordnete Straßen bleiben sichtbar.',
      corsNote:
        'Hinweis: iD lädt die GeoJSON-URL von dieser Website. Die muss Cross-Origin-Anfragen von www.openstreetmap.org erlauben (CORS). Sonst die GeoJSON-Datei herunterladen und in iD unter „Eigene Daten“ öffnen.',
      josmRemoteLead:
        'Remote Control in den JOSM-Einstellungen aktivieren. Links rufen JOSM lokal auf (Port 8111).',
      josmLoadObject: 'Relation inkl. Mitglieder laden (load_object)',
      josmImport: 'Amtliches GeoJSON als neue Ebene importieren (import)',
      josmLoadAndZoom: 'API-Ausschnitt laden und Relation auswählen (load_and_zoom)',
      josmImportDisabledHint:
        'Kein amtlicher GeoJSON-Export — zuerst Vergleich mit amtlicher Geometrie oder aktuelle Auswertung (ohne Snapshot) nutzen.',
      josmLoadAndZoomDisabledHint: 'Benötigt Kartenausschnitt und OSM-Relation-ID.',
      josmNoRelation:
        'Keine OSM-Relation-ID in dieser Zeile — nur amtliche Geometrie oder Datenlücke; Relation zuerst in OSM anlegen bzw. zuordnen.',
      josmImportFallback:
        'Falls Import per URL fehlschlägt: GeoJSON herunterladen und in JOSM über Datei öffnen.',
      josmMixedContent:
        'Von HTTPS-Seiten aus kann der Browser lokale http://127.0.0.1-Links blockieren — ggf. Link kopieren oder Lesezeichen nutzen.',
      tableHint:
        'Diese comparison_table.json enthält noch kein Feld officialForEditPath — bitte den Vergleich erneut ausführen, um die GeoJSON-Exports zu erzeugen.',
    },
  },

  map: {
    legendAria: 'Kartenlegende',
    official: 'Amtliche Grenze',
    osm: 'OpenStreetMap-Grenze',
    diff: 'Abweichungsflächen',
    simplificationLikelyBelowZoom15:
      'Geometiren werden bis Zoom 15 wahrscheinlich vereinfacht dargestellt.',
    fullDetailFromZoom15: 'Geometrien sollten volle Details haben.',
    zoomInForFullDetail: 'Auf Zoom 15 wechseln',
  },
} as const

export function categoryLabelDe(cat: ReportRow['category']): string {
  switch (cat) {
    case 'matched':
      return 'Zugeordnet'
    case 'official_only':
      return 'Nur amtlich'
    case 'unmatched_osm':
      return 'Nur OSM'
    default:
      return cat
  }
}
