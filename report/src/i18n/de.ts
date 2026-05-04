import { meanIouChartDe } from '@compare-metrics/modalCopyDe.ts'
import type { ReportRow } from '../types/report'

/** UI copy (German). Metric modal copy lives in scripts/compare/lib/metrics/ (per-metric folder, de.ts). */
export const de = {
  appTitle: 'OSM Grenzabgleich',
  navChangelog: 'Changelog',

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
    sectionAria: 'Datenquellen und Filterung',
    title: 'Datenquellen',
    leadWithMetricsCrs: (crs: string) =>
      `Verlinkt die Datenquellen und beschreibt die angewendeten Filter. Der Vergleich findet in Projektion ${crs} statt.`,
    reportCreatedLabel: 'Auswertung erstellt',
    officialDownloadLabel: 'Amtliche Geometrien (Download/Stand)',
    officialSourceUpdatedLabel: 'Amtliche Quelle aktualisiert',
    officialSourcePublishedLabel: 'Amtliche Quelle veröffentlicht',
    osmDownloadLabel: 'OSM-Geometrien (Download/Stand)',
    officialHeading: 'Amtliche Daten',
    officialFilterHeading: 'Amtliche Daten Filterung',
    officialMetaPrefix: 'Hinterlegt',
    sourceLinkLabel: 'Quelle (extern)',
    sourcePublicLinkLabel: 'Link (Webseite)',
    sourceDownloadLinkLabel: 'Link (Download)',
    dataSourceLabel: 'Datenquelle',
    directDownloadLabel: 'Direktdownload',
    filterLabel: 'Filter',
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
    osmHeading: 'OpenStreetMap Daten',
    osmFilterHeading: 'OpenStreetMap Daten Filterung',
    directDownloadDetails: {
      wfs: 'WFS',
      pbf: 'PBF',
      geojson: 'GeoJSON',
      gml: 'GML',
    },
    filterDescriptions: {
      officialMatchProperty: (value: string) =>
        `Das Feld \`${value}\` aus den amtlichen Features wird als Match-Schlüssel mit OSM verwendet.`,
      bboxFilter: {
        none: 'Es wird kein Bounding-Box-Filter vor dem Matching angewendet.',
        official_bbox_overlap:
          'OSM-Kandidaten werden räumlich auf den Bereich begrenzt, der die amtliche Abdeckung (plus Puffer) überlappt.',
      },
      bboxBufferDegrees: (value: number) =>
        `Erweitert den amtlichen Bounding-Box-Filter um ${value} Grad als Sicherheitsrand gegen Randabschneidungen.`,
      osmScopeFilter: {
        none: 'Es wird kein zusätzlicher räumlicher Scope-Filter auf OSM-Features angewendet.',
        centroid_in_official_coverage:
          'Ein OSM-Objekt zählt nur dann, wenn sein Schwerpunkt innerhalb der amtlichen Vergleichsabdeckung liegt.',
      },
      ignoreRelationIds: 'Diese OSM-Relationen werden vor dem Matching explizit ausgeschlossen.',
    },
    noFilterConfig: 'Keine konkrete Filterkonfiguration im Report enthalten.',
    noSourceData: 'Keine Quellenangaben im Report enthalten.',
    osmFilterNoteTitle: 'Zusatzhinweis aus dem Build',
  },

  home: {
    processingStatusLink: 'Verarbeitungsstatus öffnen',
    changelogLinkLabel: 'Changelog',
    reviewQueueLinkLabel: 'Prüfliste: Ampel nicht ok',
    githubCodeLinkLabel: 'Code auf GitHub',
    githubIssuesLinkLabel: 'Issue melden',
    introHeading: 'OpenStreetMap und Daten zu amtlichen Grenzen',
    introLead:
      'Diese Anwendung vergleicht verschiedene amtliche Datensätze zu Grenzen und PLZ-Bereichen mit OSM-Daten. Das Ziel ist Transparenz über die Qualität der Daten in OSM und Hilfsmittel zur Verbesserung der Datenqualität.',
    metaDescription:
      'Vergleich amtlicher Grenz- und PLZ-Daten mit OpenStreetMap: Transparenz über die Datenqualität in OSM und Hilfsmittel zu deren Verbesserung.',
    noAreas:
      'Keine Gebiete mit output/comparison_table.json unter datasets/ gefunden. Vergleich ausführen (bun run compare).',
    /** Home list: per-area row of category/review counts. */
    categoryStatsAria:
      'Zugeordnet, nur amtlich, OSM ohne Treffer in offiziellen Daten, Prüfung, Problem — Anzahl',
    unmatchedStat: 'Nur OSM',
    reviewsStat: 'Prüfung',
    issuesStat: 'Problem',
    unmatchedLink: 'Liste: OSM ohne Treffer im amtlichen Export',
  },

  review: {
    breadcrumb: 'Prüfliste',
    title: 'Prüfliste: Ampel nicht ok',
    intro:
      'Schnellzugriff auf Grenzen, die in der letzten Auswertung voraussichtlich Nacharbeit brauchen. Gezeigt werden alle Einträge mit Bewertungsampel review oder issue.',
    empty: 'Aktuell keine Einträge mit Ampel != ok gefunden.',
    totalStatsAria: 'Anzahl betroffener Datensätze sowie Einträge mit review oder issue',
    datasetCount: 'Datensätze',
    reviewsCount: 'Prüfung',
    issuesCount: 'Problem',
    sectionCountSuffix: 'Einträge',
    table: {
      name: 'Name',
      key: 'Schlüssel',
      category: 'Kategorie',
      issueLevel: 'Bewertung',
      view: 'Detail',
    },
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

  changelog: {
    heading: 'Changelog',
    loading: 'Lade Changelog…',
    error: 'Changelog konnte nicht geladen werden.',
    empty: 'Noch keine Changelog-Einträge.',
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
    compareFailedNotice:
      'Der Vergleich für dieses Gebiet ist im letzten Lauf fehlgeschlagen. Der nächste Lauf versucht es automatisch erneut.',
    compareFallbackNotice:
      'Der Vergleich für dieses Gebiet ist fehlgeschlagen; es werden zuletzt erfolgreiche Vergleichsdaten angezeigt.',
    table: {
      name: 'Name',
      key: 'Schlüssel',
      category: 'Kategorie',
      iou: 'IoU',
      areaDelta: 'Δ Fläche %',
      hausdorff: 'Hausdorff',
      hausdorffP95: 'Hausdorff P95',
      issueIndicator: 'Bewertung',
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
      /** Overview map: overlapping official-only vs unmatched OSM polygons. */
      mapOverlapPickerTitle: 'Mehrere Objekte an dieser Stelle',
      mapOverlapPickerLead:
        'Amtliche Fläche (nur amtlich) und OSM-Fläche (nur OSM) liegen hier übereinander. Wählen Sie die gewünschte Detailansicht.',
      mapOverlapPickerClose: 'Schließen',
    },
  },

  feature: {
    back: '← Zurück zur Tabelle',
    loading: 'Laden…',
    notFound: 'Objekt nicht gefunden.',
    compareFailedNotice:
      'Der Vergleich für dieses Gebiet ist im letzten Lauf fehlgeschlagen. Die Detailansicht kann unvollständig sein.',
    loadingMap: 'Karte wird geladen …',
    osmRelation: 'OSM-Relation',
    stats: {
      iou: 'IoU',
      areaDelta: 'Flächenabweichung',
      symDiff: 'Symmetrische Differenz',
      /** Narrow KPI column at `lg`; full phrase below `lg`. */
      symDiffShort: 'Symmetrische Diff.',
      hausdorff: 'Hausdorff-Abstand',
      hausdorffP95: 'Hausdorff P95',
      issueIndicator: 'Bewertungsampel',
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
      'Du kannst dir Rohdaten in der Bounding Box um das aktuelle Feature anzeigen lassen, um ganz aktuelle Daten mit dem zu vergleichen, was die App gerade anzeigt.',
    liveOfficialHeading: 'Amtliche Quelle (WFS)',
    liveOfficialLoad: 'Eigenschaften laden',
    liveOfficialLoading: 'Wird geladen …',
    liveOfficialNoBbox: 'Kein Kartenausschnitt — für dieses Objekt liegt keine Geometrie vor.',
    liveOfficialEmpty: 'Keine Treffer im Ausschnitt.',
    liveOfficialInvalidJson: 'Unerwartete WFS-Antwort (kein FeatureCollection).',
    liveOfficialUnsupportedFormat:
      'Diese WFS-Quelle liefert kein GeoJSON. Bitte ohne JSON-Format anfragen oder ein WFS/GML-Format nutzen.',
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
    datasetOsmCardTitle: 'OSM-Daten (Auszug)',
    datasetOsmOpenHistory: 'Auf osm.org anzeigen',
    datasetPropertiesEmpty: '—',
    datasetPropertiesLegacySnapshot:
      'Für diesen Snapshot sind keine gespeicherten Attribute verfügbar — Vergleich erneut ausführen.',

    updateMap: {
      title: 'Daten in OSM bearbeiten',
      lead: 'Amtliche Referenzgeometrie als GeoJSON sowie Direktlinks zu iD und JOSM — für Abgleich und Korrektur der OSM-Grenze.',
      downloadOfficialHeading: 'Amtliches GeoJSON',
      idHeading: 'iD-Editor',
      josmHeading: 'JOSM (Remote Control)',
      downloadOfficial: 'Amtliches Polygon laden (GeoJSON)',
      downloadOfficialDisabledHint: 'Für diese Detailansicht gibt es keine amtliche Geometrie.',
      downloadOfficialHint:
        'Datei enthält u. a. Namen, Schlüssel und Felder wie `officialSource.provider`, `officialSource.dataset`, `officialSource.sourcePublicUrl` usw., sofern beim Vergleich hinterlegt.',
      opensInNewWindowTitle: 'Öffnet in einem neuen Browser-Tab',
      openId: 'In iD öffnen',
      idDisableFeaturesHint:
        'Hinweis: In iD werden u. a. Gebäude, Wege und Bahn usw. ausgeblendet; Grenzen, Gewässer und übergeordnete Straßen bleiben sichtbar.',
      josmRemoteLead:
        'Remote Control in den JOSM-Einstellungen aktivieren. Links rufen JOSM lokal auf (Port 8111).',
      josmLoadObject: 'Relation inkl. Mitglieder laden (load_object)',
      josmImport: 'Amtliches GeoJSON als neue Ebene importieren (import)',
      josmImportDisabledHint:
        'Kein amtlicher GeoJSON-Export — zuerst Vergleich mit amtlicher Geometrie oder aktuelle Auswertung (ohne Snapshot) nutzen.',
      josmNoRelation:
        'Keine OSM-Relation-ID in dieser Zeile — nur amtliche Geometrie oder Datenlücke; Relation zuerst in OSM anlegen bzw. zuordnen.',
      josmImportFallback:
        'Falls Import per URL fehlschlägt: GeoJSON herunterladen und in JOSM über Datei öffnen.',
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

export function issueLevelLabelDe(level: 'ok' | 'review' | 'issue'): string {
  switch (level) {
    case 'ok':
      return 'OK'
    case 'review':
      return 'Prüfung'
    case 'issue':
      return 'Problem'
  }
}

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
