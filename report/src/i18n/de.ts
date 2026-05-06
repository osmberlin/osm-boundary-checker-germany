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
    /** Same topic as `germanKeyExplorer.title` (amtlicher ARS / amtlicher AGS). */
    germanKeyExplorerLink: 'Regional- und Gemeindeschlüssel-Explorer',
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
    sectionAria: 'Datenquellen und Datensatz-Abgleich',
    title: 'Datenquelle, Filter und Vergleichsregeln',
    reportCreatedLabel: 'Auswertung erstellt',
    officialDownloadLabel: 'Amtliche Geometrie (letzter Bezug)',
    officialSourceStandLabel: 'Amtlicher Datenstand',
    officialSourceVerifiedLabel: 'Datenstand verifiziert',
    officialSourceUpdatedLabel: 'Amtliche Quelle aktualisiert',
    officialSourcePublishedLabel: 'Amtliche Quelle veröffentlicht',
    osmDownloadLabel: 'OSM-Geometrien (Download/Stand)',
    officialHeading: 'Amtliche Daten',
    officialSourceHeading: 'Datenquelle der amtlichen Daten',
    officialMetaPrefix: 'Hinterlegt',
    sourceLinkLabel: 'Quelle (extern)',
    sourcePublicLinkLabel: 'Link (Webseite)',
    sourceDownloadLinkLabel: 'Link (Download)',
    dataSourceLabel: 'Datenquelle',
    directDownloadLabel: 'Direktdownload',
    licenseLabel: 'Lizenz',
    licenseSectionHeading: 'Lizenz und OSM-Kompatibilität der amtlichen Quelle',
    licenseShortNameLabel: 'Originale Lizenz (Kurzname)',
    licenseSourceLabel: 'Lizenzquelle',
    osmCompatibilityLabelTitle: 'OSM-kompatibel',
    osmCompatibilitySourceLabel: 'Kompatibilitätsnachweis',
    unknown: 'Unbekannt',
    osmCompatibilityLabel: {
      unknown: 'Unbekannt',
      no: 'Nein',
      yes_licence: 'Ja (Lizenz oder Freigabe)',
      yes_waiver: 'Ja (Lizenz oder Freigabe)',
    },
    osmHeading: 'OpenStreetMap Daten',
    osmSourceHeading: 'Datenquelle der OSM-Daten',
    compareHeading: 'Datenabgleich',
    compareMappingHeading: 'Vergleichsregeln',
    compareDataHeading: 'Vergleichsdaten',
    compareDataLead:
      'Diese Daten wurden für den Vergleich entsprechend der Regeln unten verwendet:',
    compareDataOsmLabel: 'OSM-Daten',
    compareDataOfficialLabel: 'Amtliche Daten',
    compareDataMissing: '(missing)',
    compareDataExplorerLink: 'Regional- und Gemeindeschlüssel-Explorer',
    compareMappingLeadWithMetricsCrs: (crs: string) =>
      `Definiert, welche Felder aus amtlichen Daten und OSM einander zugeordnet werden und zu welchem gemeinsamen Schlüssel normalisiert wird. Metriken beziehen sich auf Projektion ${crs}.`,
    compareMappingEmpty:
      'Keine expliziten Mapping-Regeln im Report eingebettet (Schlüsselfelder/Preset fehlen).',
    compareOsmFilterHeading: 'Filterung der OSM Daten',
    compareOfficialFilterHeading: 'Filterung der amtlichen Daten',
    compareFilterLead:
      'Begrenzt, welche vorbereiteten Datensätze in die Vergleichsphase gelangen (Räumlichkeit, Layer, OSM-Scope).',
    compareFilterEmpty: 'Keine zusätzlichen Filterregeln im Report eingebettet.',
    compareNoCompareConfig:
      'Keine Abgleichskonfiguration im Report eingebettet (kein Filter-Summary oder Preset vorhanden).',
    compareOsmMatchTag: (tag: string) =>
      `Zuordnung erfolgt über den Wert von \`${tag}\` auf der OSM-Relation. Dieselbe Normalisierung wie auf der amtlichen Seite wird vor dem Vergleich angewendet.`,
    compareIdNormalization: (...args: [string, string]) => {
      void args
      return `Legt fest, wie Rohwerte aus amtlichem Schlüsselfeld und OSM-Tag vor dem paarweisen Abgleich normalisiert werden.`
    },
    compareBoundaryTag: (value: string) =>
      `Im OSM-Extrakt und für Live-Anbindungen gilt \`boundary=${value}\`.`,
    compareAdminLevels: (levelsCsv: string) =>
      `Erwartete \`admin_level\`-Werte auf der OSM-Seite für diesen Datensatz: ${levelsCsv}.`,
    compareMatchCriteriaProperty:
      'Zusätzliches OSM-Match über Tag-Vergleich (matchCriteria.kind=property gemäß Konfiguration).',
    compareMatchCriteriaRelations: (ids: string) =>
      `Zusätzliches OSM-Match nur für Relation-ID(s): ${ids}.`,
    /** Labels for idNormalization presets not covered by the Regional- und Gemeindeschlüssel-Explorer page. */
    idNormalizationPresetExtraLabels: {
      'plz-5': 'Postleitzahl',
      text: 'Text (Name)',
    },
    compareOfficialExtractLayer:
      'Dieser amtliche GDAL/WFS-Layer liefert die Geometrien und Attribute für diesen Vergleich.',
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
    noSourceData: 'Keine Quellenangaben im Report enthalten.',
    osmFilterNoteTitle: 'Zusatzhinweis aus dem Build',
  },

  home: {
    processingStatusLink: 'Verarbeitungsstatus öffnen',
    changelogLinkLabel: 'Changelog',
    reviewQueueLinkLabel: 'Prüfliste: Ampel nicht ok',
    githubCodeLinkLabel: 'Code auf GitHub',
    githubIssuesLinkLabel: 'Issue melden',
    launchBlogpostLinkLabel: 'Mehr im Launch-Blogpost…',
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
      key: 'Schlüssel (canonicalMatchKey)',
      category: 'Kategorie',
      issueLevel: 'Bewertung',
      view: 'Detail',
    },
  },

  status: {
    breadcrumb: 'Verarbeitungsstatus',
    title: 'Verarbeitungsstatus',
    /** Keep in sync with .github/workflows/data-refresh.yml schedule (cron + timezone). */
    dataRefreshCadence:
      'Vergleich und veröffentlichte Auswertungen werden automatisch viermal pro Woche neu erstellt (sonntags, mittwochs, freitags und samstags jeweils um 04:00 Uhr Europe/Berlin). Diese Seite zeigt den aktuellen Stand der Verarbeitung.',
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
      key: 'Schlüssel (canonicalMatchKey)',
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
    /** Feature map: show only the selected boundary vs all boundaries in the tiles (URL `allBoundaries`). */
    mapBoundaryScopeOnly: 'Nur ausgewählte Grenze zeigen',
    mapBoundaryScopeAll: 'Alle Grenzen zeigen',
    mapBoundaryScopeAria: 'Kartenausschnitt: nur ausgewählte Grenze oder alle Grenzen',
    osmRelation: 'OSM-Relation',
    stats: {
      /** Matches JSON field name; shown next to key value on the feature header row. */
      canonicalMatchKeyField: 'canonicalMatchKey',
      /** aria-label fragment for header key group including the canonical value. */
      canonicalMatchKeyGroupAria: 'Abgleichsschlüssel',
      iou: 'IoU',
      areaDelta: 'Flächenabweichung',
      symDiff: 'Symmetrische Differenz',
      /** Narrow KPI column at `lg`; full phrase below `lg`. */
      symDiffShort: 'Symmetrische Diff.',
      hausdorff: 'Hausdorff-Abstand',
      hausdorffP95: 'Hausdorff P95',
      issueIndicator: 'Bewertungsampel',
      /** KPI band: first column when there are no overlap metrics but the row is OSM-only or official-only. */
      unmatchedCompareLabel: 'Zuordnung',
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
    noPmtiles:
      'Kein Kachel-Archiv (comparison.pmtiles) vorhanden — Vergleich mit Geometrien ausführen (tippecanoe erforderlich).',
    liveSourcesSectionAria: 'Live-Attribute von amtlichen Diensten und OSM',
    liveSourcesSectionTitle: 'Live-Daten anzeigen',
    liveSourcesSectionLead:
      'Es kann hilfreich sein, sich die aktuellen Daten in der aktuellen BBOX zum Vergleich anzeigen zu lassen.',
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
    datasetPropertiesSectionTitle: 'Attribute zum Zeitpunkt des Vergleichs',
    datasetOfficialCardTitle: 'Amtliche Daten',
    datasetOsmCardTitle: 'OSM-Daten (Auszug)',
    /** `official.sourceUpdatedAt` / `sourcePublishedAt` (vendor reference date). */
    datasetExtractSourceDateLabel: 'Referenzdatum (Anbieter)',
    /** `official.sourceUpdatedAtVerifiedAt` (upstream metadata re-confirmed). */
    datasetExtractCheckedDateLabel: 'Metadaten zuletzt geprüft',
    /** `official.downloadedAt` (last geometry fetch). */
    datasetExtractGeometryFetchedLabel: 'Geometrie zuletzt geladen',
    datasetExtractOsmSnapshotLabel: 'Planet-Stichtag (PBF-Kopf)',
    datasetExtractOsmExtractLabel: 'Extrakt erzeugt (Pipeline)',
    datasetExtractOsmUncertainNote:
      'Planet-Stichtag steht nicht im PBF-Header — der zweite Zeitpunkt beschreibt den lokal erzeugten Extrakt, nicht den Planet-Stand.',
    datasetOsmOpenHistory: 'Auf osm.org anzeigen',
    datasetPropertiesEmpty: '—',
    datasetPropertiesLegacySnapshot:
      'Für diesen Snapshot sind keine gespeicherten Attribute verfügbar — Vergleich erneut ausführen.',

    expectedOsmTagsSectionAria: 'Erwartete OSM-Tags für den Abgleich',
    expectedOsmTagsSectionTitle: 'Erwartete OSM-Tags',
    expectedOsmTagsSectionLead:
      'Diese Grenze ist in OpenStreetMap bisher nicht zugeordnet. Damit der Abgleich greift, sollte die passende Grenz-Relation folgende Tags enthalten (laut aktueller Datensatz-Konfiguration):',
    decodeKeyExplorerLink: 'Schlüssel-Felder dekodieren',
    matcherContextSectionAria: 'Vergleichsregeln für diesen Datensatz',
    matcherContextSectionTitle: 'Abgleich: OSM-Referenz und Filter',
    matcherContextSectionLead:
      'Diese OSM-Grenze hat kein passendes amtliches Gegenstück in diesem Datensatz. So ist der Abgleich konfiguriert (ohne Live-Abfrage):',
    matcherBoundaryTag: 'Overpass boundary',
    matcherOfficialProperty: 'Amtliches Match-Feld',
    matcherOsmProperty: 'OSM Match-Tag',
    matcherAdminLevels: 'admin_level (erwartet)',
    matcherBboxFilter: 'Bounding-Box-Filter',
    matcherOsmScope: 'OSM-Geometrie-Filter',
    matcherIgnoreRelations: 'Ignorierte Relation-IDs',
    matcherIdPreset: 'Schlüssel-Normalisierung',
    matcherOsmCriteria: 'OSM-Match',
    matcherCriteriaProperty: 'über Tag-Vergleich',
    matcherCriteriaRelations: (ids: string) => `Relation-ID(s): ${ids}`,
    matcherDecodeKeyLink: 'Schlüssel dekodieren',

    updateMap: {
      title: 'Daten in OSM bearbeiten',
      downloadOfficialHeading: 'Amtliches GeoJSON',
      idHeading: 'iD-Editor',
      josmHeading: 'JOSM (Remote Control)',
      downloadOfficial: 'GeoJSON herunterladen',
      downloadOfficialDisabledHint: 'Für diese Detailansicht gibt es keine amtliche Geometrie.',
      downloadOfficialHint:
        'Datei enthält u. a. Namen, Schlüssel und Felder wie `officialSource.provider`, `officialSource.dataset`, `officialSource.sourcePublicUrl` usw., sofern beim Vergleich hinterlegt.',
      downloadOfficialPipelineHint:
        'Hinweis: Beim Export werden die Umringe leicht vereinfacht (ca. 2,5 m Toleranz) und Koordinaten auf sechs Nachkommastellen gerundet — für überschaubare Dateigröße in iD/JOSM.',
      revealHintAriaLabel: 'Hinweis anzeigen',
      opensInNewWindowTitle: 'Öffnet in einem neuen Browser-Tab',
      openId: 'In iD öffnen mit amtlicher Grenze (GeoJSON)',
      idDisableFeaturesHint:
        'Hinweis: In iD werden u. a. Gebäude, Wege und Bahn usw. ausgeblendet; Grenzen, Gewässer und übergeordnete Straßen bleiben sichtbar. Wichtig: Es kann sein, dass einzelne Punkte in dieser Ansicht nicht verschoben werden können. Wenn das passiert, musst du die Filtereinstellungen ändern und bspw. die Landnutzung einschalten. Denn diese Situation bedeutet, dass die Grenze mit einem Element verklebt ist, das zur Zeit versteckt ist — und daher darf sie nicht „blind“ verschoben werden. In diesem Fall dann die Verklebung lösen und die Elemente getrennt voneinander behandeln.',
      josmRemoteLead:
        'Remote Control in den JOSM-Einstellungen aktivieren. Links rufen JOSM lokal auf (Port 8111).',
      josmLoadObject: 'OSM Relation in JOSM laden',
      josmLoadObjectTitle: 'Relation inkl. Mitglieder (Remote Control: load_object)',
      josmImport: 'In JOSM öffnen mit amtlicher Grenze (GeoJSON)',
      josmImportTitle: 'Amtliches GeoJSON als neue Ebene (Remote Control: import)',
      josmImportDisabledHint:
        'Kein amtlicher GeoJSON-Export — zuerst Vergleich mit amtlicher Geometrie oder aktuelle Auswertung (ohne Snapshot) nutzen.',
      josmImportFallback:
        'Falls Import per URL fehlschlägt: GeoJSON herunterladen und in JOSM über Datei öffnen.',
      tableHint:
        'Diese comparison_table.json enthält noch kein Feld officialForEditPath — bitte den Vergleich erneut ausführen, um die GeoJSON-Exports zu erzeugen.',
    },
  },

  germanKeyExplorer: {
    metaTitle: 'Regional- und Gemeindeschlüssel-Explorer',
    title: 'Regional- und Gemeindeschlüssel-Explorer',
    lead: 'Hier können Sie den amtlichen Regionalschlüssel (ARS) und den amtlichen Gemeindeschlüssel (AGS) nachvollziehen: Schlüssel in ihre Segmente zerlegen und die Bezeichnungen der Verwaltungsebenen aus dem Destatis-Gemeindeverzeichnis (GV100AD) anzeigen — in der amtlichen Terminologie von Bund und Ländern.',
    loadingLookup: 'Gemeindeverzeichnis-Daten werden geladen …',
    lookupErrorPrefix: 'Die Schlüssel-Daten konnten nicht geladen werden.',
    sourcesIntroLead:
      'Die Namen stammen aus der amtlichen GV100AD-Textdatei des Gemeindeverzeichnisses (Destatis).',
    /** Prefix before comma-separated Destatis links in the explorer header. */
    sourcesDataSourcesLabel: 'Datenquellen:',
    sourcesIntroLatestSnapshot: (dateLabel: string) =>
      `TXT-Stichtag in der gewählten Quartalsdatei: ${dateLabel}.`,
    obsoleteNoticeLead:
      'Mindestens ein angezeigter Name ist nur in einer älteren GV100ADJ-Jahresausgabe erhalten — in der aktuellen Quartalsdatei fehlt dieser Schlüssel.',
    obsoleteNoticeYearBadge: (year: number) => `31.12.${year}:`,
    obsoleteNoticePublicationLink: 'Destatis-Publikationsseite',
    obsoleteYearSuffix: (year: number) => `nur GV100ADJ bis ${year}`,
    nameSearchNoResults:
      'Kein Gemeinde-/Gebietseintrag gefunden. Für Namenssuche mindestens zwei Zeichen eingeben; für Schlüssel die Ziffern nutzen.',
    nameSearchPickTitle: 'Mehrere Treffer',
    nameSearchPickLead:
      'Bitte einen Eintrag auswählen — der Schlüssel wird für die Ansicht übernommen.',
    nameSearchPickApply: 'Übernehmen',
    nameSearchPickClose: 'Schließen',
    inputLabel: 'Schlüssel oder Gemeinde-Name',
    inputPlaceholder: 'z. B. 11001, Flensburg, 010515163022',
    presetLabel: 'Preset hervorheben',
    presetHint:
      'Nur Presets für AGS/ARS und verwandte Schlüssel (wie idNormalization.preset in der Datensatz-Konfiguration). „Alle“ hebt keine Zeile in der Tabelle hervor.',
    presetOptionAll: 'Alle Presets',
    areaBadge: (area: string) => `Datensatz: ${area}`,
    submitUrl: 'Aktualisieren',
    arsTableTitle: 'Regionalschlüssel (12 Stellen, ARS)',
    segmentBl: 'Bundesland',
    segmentRb: 'Regierungsbezirk',
    segmentKreis: 'Kreis / kreisfreie Stadt',
    segmentVg: 'Gemeindeverband',
    segmentGem: 'Gemeinde',
    noRegierungsbezirk: 'Kein Regierungsbezirk',
    noGemeindeverband: 'Kein Gemeindeverband',
    agsTitle: 'Amtlicher Gemeindeschlüssel (8 Stellen, AGS)',
    agsLead:
      'Aus einer vollständigen 12-stelligen ARS ergibt sich der AGS aus LLRKK + GGG (also ohne die 4 Stellen des Gemeindeverbands).',
    agsFromArs: 'Aus 12-stelligem Schlüssel',
    derivedBb: 'Brandenburg-Preset (erste 5 + letzte 3 Ziffern der ARS)',
    berlinTitle: 'Berlin Bezirk',
    berlinLead:
      'Kurzform mit fünf Ziffern (z. B. 11001) wird im Vergleich auf acht Stellen expandiert.',
    berlinExpanded: 'Expandiert (berlin-bezirk-ags)',
    statistikportalTitle: 'Gemeindeverzeichnis',
    statistikportalLead:
      'Onlineabfrage des Statistikportals (Stichtag und Hinweise siehe dort). Deep-Link mit 8-stelligem AGS:',
    statistikportalButton: 'Im Gemeindeverzeichnis öffnen',
    statistikportalHomePage: 'Statistikportal — Gemeindeverzeichnis (Start)',
    arsTableEmpty:
      'Keine vollständige 12-stellige ARS aus den Ziffern ableitbar — siehe Normalisierung unter „regional-12“.',
    wikiLinksTitle: 'OSM-Wiki',
    wikiRsLabel: 'de:regionalschluessel',
    wikiAgsLabel: 'de:amtlicher_gemeindeschluessel',
    normalizationTitle: 'Normalisierung im Datenvergleich',
    normalizationLead:
      'Pro Datensatz kann eine Normalisierung angegeben werden. Hier stehen die Ergebnisse für den angegebenen Wert für alle Normalisierungen.',
    colPreset: 'Preset',
    colCanonical: 'matchKey',
    colName: 'Name',
    colNotes: 'Anmerkungen',
    /** Matches `notes` tokens from `normalizeOsmValue` (Regional- und Gemeindeschlüssel-Explorer UI only). */
    normalizationNoteUnexpectedDigitLength: (digitCount: string) =>
      `Unerwartete Ziffernlänge (${digitCount} Ziffern); dieses Preset sieht andere Längen vor.`,
    normalizationNotesUi: {
      'berlin-5-digit→8-digit-ags':
        'Berlin: 5-stellige Bezirksnummer zur AGS-8-Darstellung erweitert',
      'already-8-digit': 'Bereits 8-stellig (keine Änderung)',
      'regional-12-padded': 'Weniger als 12 Ziffern — rechts mit Nullen auf 12 Stellen ergänzt',
      'bb-gemeinden-first5-plus-last3':
        'Brandenburg: erste 5 und letzte 3 Ziffern der 12-stelligen ARS → 8-stellig',
      'bb-gemeinden-already-8': 'Bereits 8-stellig im Sinne des Brandenburg-Presets',
      'plz-5-truncated': 'Mehr als 5 Ziffern — auf 5 Stellen gekürzt',
      'plz-5-left-padded': 'Weniger als 5 Ziffern — links mit Nullen auf 5 Stellen',
    },
    emptyState:
      'Bitte einen Schlüssel oder einen Suchbegriff (Name) eingeben oder per URL ?key= übergeben.',
    keyOverviewTitle: 'Schlüssel in OSM und BKG',
    keyOverviewLead:
      'Je nach Datensatz wird mit 12-stelligem ARS oder 8-stelligem AGS gearbeitet. Diese Tabelle zeigt die gebräuchlichen Schlüssel und Bezeichnungen.',
    keyOverviewColValue: 'Wert',
    keyOverviewColOsmKey: 'Key OSM',
    keyOverviewColBkgKey: 'Key BKG',
    keyOverviewColLength: 'Länge',
    keyOverviewArsName: 'Regionalschlüssel',
    keyOverviewAgsName: 'Amtlicher Gemeindeschlüssel',
    linksTitle: 'Links',
    linksDetailPage: 'Detailseite Statistikportal',
    linksWikiKeyPrefix: 'OSM Wiki',
    presets: {
      'berlin-bezirk-ags': 'Berlin Bezirk → AGS-8',
      'amtlicher-8': 'Amtlicher 8-stellig',
      'regional-12': 'Regionalschlüssel 12-stellig',
      'brandenburg-gemeinden-8': 'Brandenburg Gemeinden',
    },
  },

  map: {
    legendAria: 'Kartenlegende',
    official: 'Amtliche Grenze',
    osm: 'OpenStreetMap-Grenze',
    diff: 'Abweichungsflächen',
    simplificationLikelyBelowZoom15:
      'Geometrien werden bis Zoom 15 wahrscheinlich vereinfacht dargestellt.',
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
