import { meanIouChartDe } from '@compare-metrics/modalCopyDe.ts'
import type { SourceKind } from '../../../scripts/shared/sourceKind.ts'
import { formatDeInteger } from '../lib/formatDe'
import type { ReportRow } from '../types/report'
import { sourceText } from './sourceVocabulary'

/**
 * OSM admin RS datasets: shared paragraph under provenance „Vergleichsregeln“ when both German admin tags are listed.
 */
export const osmAdminGermanDualKeyLead = {
  rsFirst:
    'Zuordnung erfolgt über `de:regionalschluessel` auf der OSM-Relation und das amtliche Schlüsselfeld (z. B. ARS bzw. LGB `ars`), jeweils mit dem eingestellten Normalisierungs-Preset. `de:amtlicher_gemeindeschluessel` ist nicht Teil des Abgleichs, wird aber für die Datenpflege empfohlen.',
} as const

/**
 * Metric column titles shared by the Gebiete results table (`de.areaReport.table`)
 * and the feature-detail KPI row (`de.feature.stats`). Hausdorff short labels describe
 * the measure (boundary gap), not the eponym.
 */
const areaReportTableMetricLabels = {
  iou: 'IoU',
  areaDelta: 'Δ Fläche %',
  /** Discrete max gap along the two boundaries (m). */
  hausdorff: 'Max. Randabstand',
  /** Robust boundary-distance percentile. */
  hausdorffP95: 'Randabstand P95',
  issueIndicator: 'Bewertung',
} as const

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
    regionalHubLink: 'Einwohner und Wikidata',
    geoDataLine: 'Geodaten: ',
    osmLinkHref: 'https://www.openstreetmap.org/copyright',
    osmLinkLabel: 'OpenStreetMap',
    geoDataBetween: ' und ',
    bkgLinkHref: 'https://www.bkg.bund.de/',
    bkgLinkLabel: 'Bundesamt für Kartographie und Geodäsie (VG25 u. a.)',
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
    configLinkLabel: 'Konfigurationsdatei',
    configLinkAria: (area: string) =>
      `Konfigurationsdatei \`${area}/config.jsonc\` auf GitHub öffnen`,
    reportCreatedLabel: 'Auswertung erstellt',
    officialDownloadLabel: 'Amtliche Geometrie (letzter Bezug)',
    officialSourceStandLabel: 'Amtlicher Datenstand',
    officialSourceVerifiedLabel: 'Datenstand verifiziert',
    officialSourceUpdatedLabel: 'Amtliche Quelle aktualisiert',
    officialSourcePublishedLabel: 'Amtliche Quelle veröffentlicht',
    osmDownloadLabel: 'OSM-Geometrien (Download/Stand)',
    officialSourceHeading: 'Datenquelle der amtlichen Daten',
    officialMetaPrefix: 'Hinterlegt',
    sourceLinkLabel: 'Quelle (extern)',
    sourcePublicLinkLabel: 'Link (Webseite)',
    sourceDownloadLinkLabel: 'Link (Download)',
    dataSourceLabel: 'Datenquelle',
    directDownloadLabel: 'Direktdownload',
    licenseLabel: 'Lizenz',
    /** Homepage license table: first column is area display name, not feature name+key. */
    licenseTableAreaColumn: 'Gebiet',
    /** Bundled BKG VG25 rows on homepage (same official preset family). */
    licenseHomeBkgBundleLabel: 'Bundesamt für Kartographie und Geodäsie (VG25)',
    licenseHomeBkgBundleSubline:
      'Gemeinsame amtliche Grundlage für die deutschlandweiten LIST-Datensätze in dieser Übersicht.',
    /** Multiple areas sharing the same direct download URL (non-BKG bundle). */
    licenseHomeSharedDownloadSourceLabel: 'Gemeinsame amtliche Download-Quelle',
    licenseHomeSharedDownloadSourceSubline:
      'Mehrere der oben gelisteten Vergleichsgebiete nutzen dieselbe technische Download-Adresse für die amtlichen Daten. Sind Lizenz und OSM-Kompatibilität gleich, stehen sie hier nur einmal.',
    /** After merged-group explanation: comma-separated dataset links (homepage licence table). */
    licenseHomeMergedDatasetListLead: 'Zugehörige Vergleichsgebiete:',
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
      /** Dataset level only: licence differs per geometry. */
      partial: 'Teilweise',
    },
    /** Licence per geometry (DtP): row-level section, area overview table and homepage row. */
    licensePerGeometry: {
      mixedLabel: 'Pro Gebiet unterschiedlich',
      geometrySourceLabel: 'Geometriequelle',
      overviewHint:
        'Die Lizenz steht bei Digitize the Planet pro Geometrie. Ob sie zu OSM passt, bewerten wir selbst; eine Freigabe der Quelle (Behörde) hebt die Standardregel einer Lizenz auf.',
      columnSource: 'Quelle',
      columnLicense: 'Lizenz',
      columnAreas: 'Gebiete',
      columnCompatible: 'OSM-kompatibel',
      columnRule: 'Regelung / Nachweis',
      unknownSource: 'Unbekannte Quelle',
      evidenceLink: 'Nachweis',
      decidedAt: (date: string) => `Entschieden am ${date}`,
      summaryHint:
        'Die Lizenz steht bei Digitize the Planet pro Geometrie; sie ist deshalb für jedes Gebiet einzeln zu prüfen.',
      showOverview: (sourceCount: number) =>
        `Lizenzübersicht anzeigen (${sourceCount} Quellen und Lizenzen)`,
      homeOverviewLink: 'Lizenzübersicht',
      homeCompatibleAll: 'Ja',
      homeCompatibleCount: (status: string, compatible: string, total: string) =>
        `${status} (${compatible} von ${total} Gebieten)`,
    },
    osmHeading: 'OpenStreetMap Daten',
    osmSourceHeading: 'Datenquelle der OSM-Daten',
    compareHeading: 'Datenabgleich',
    compareMappingHeading: 'Vergleichsregeln',
    compareDataHeading: 'Vergleichsdaten',
    compareDataLead:
      'Diese Daten wurden für den Vergleich entsprechend der Regeln unten verwendet:',
    /** Shown under Vergleichsdaten when the OSM side is present (admin RS). */
    compareDataOsCanonicalNote:
      'Die OSM-Zeile zeigt den kanonischen Vergleichsschlüssel nach Normalisierung aus `de:regionalschluessel` (Priorität und Normalisierung unter „Vergleichsregeln“; Tag-Rohwerte über Live-Eigenschaften).',
    compareDataOsmLabel: 'OSM-Daten',
    compareDataMissing: '(missing)',
    compareMappingLeadWithMetricsCrs: (crs: string) =>
      `Definiert, welche Felder aus amtlichen Daten und OSM einander zugeordnet werden und zu welchem gemeinsamen Schlüssel normalisiert wird. Metriken beziehen sich auf Projektion ${crs}.`,
    compareMappingEmpty:
      'Keine expliziten Mapping-Regeln im Report eingebettet (Schlüsselfelder/Preset fehlen).',
    /** One sentence under Vergleichsregeln when a dataset has several match rules. */
    compareRulesOrderLead:
      'Die Regeln laufen der Reihe nach: Jede Regel betrachtet nur Zeilen, die noch keinem OSM-Objekt zugeordnet sind, und ein OSM-Objekt wird höchstens einmal verwendet.',
    /** Descriptions of the match rules; `data` is the dative plural of the source wording ("amtlichen Daten", "DtP-Daten"). */
    matchRuleDescriptions: {
      key: (officialProperty: string, osmTag: string, data: string) =>
        `Das Feld \`${officialProperty}\` aus den ${data} wird mit dem Wert von \`${osmTag}\` auf dem OSM-Objekt verglichen. Beide Seiten werden vorher gleich normalisiert.`,
      relation_id: (relationIds: string, officialProperty: string) =>
        `Zuordnung nur für die OSM-Relation-ID(s) ${relationIds}; der Schlüssel kommt aus dem Feld \`${officialProperty}\`.`,
      osm_reference: (officialProperty: string, data: string) =>
        `Das Feld \`${officialProperty}\` aus den ${data} nennt ein OSM-Objekt (zum Beispiel relation/123); dieses Objekt wird zugeordnet.`,
      /** Rule on `override_osm_ref`: our reviewed correction, which DtP does not name. */
      osm_reference_override:
        'Unsere geprüfte Korrektur verweist auf dieses OSM-Objekt (DtP nennt es nicht).',
      osm_tag: (officialProperty: string, osmTag: string, data: string) =>
        `Das OSM-Objekt, dessen Tag \`${osmTag}\` dem Wert von \`${officialProperty}\` aus den ${data} entspricht, wird zugeordnet.`,
    },
    /** Under Vergleichsdaten: the rule that paired this row; `rule` is the 1-based position. */
    matchedByRule: (rule: number, how: string) => `Zugeordnet über Regel ${rule} (${how})`,
    matchedByHow: {
      key: 'Schlüssel',
      relation_id: 'Relation-ID',
      osm_reference: (data: string, ref: string) => `OSM-Verweis der ${data}: ${ref}`,
      /** Rule on `override_osm_ref`: the reviewed correction, not a reference DtP made. */
      osm_override: (ref: string) => `geprüfte Korrektur: ${ref}`,
      osm_tag: (osmTag: string, value: string) => `OSM-Tag ${osmTag} = ${value}`,
    },
    /** Second paragraph under Vergleichsregeln when `osmMatchProperties` lists both German admin keys. */
    compareMappingDualGermanKeysLeadRsFirst: osmAdminGermanDualKeyLead.rsFirst,
    /** Single list item replacing two generic `compareOsmMatchTag` bullets for the German dual-key case. */
    compareOsmMatchGermanDualCode: (orderedTags: string) => `osmMatchTag[]=${orderedTags}`,
    compareOsmMatchGermanDualDescription:
      'Prioritätsreihenfolge wie im Absatz darüber: die Konfiguration listet dieselben Tags in derselben Reihenfolge (`osmMatchTag[0]` zuerst).',
    compareOsmFilterHeading: 'Filterung der OSM Daten',
    compareOfficialFilterHeading: 'Filterung der amtlichen Daten',
    compareFilterLead:
      'Begrenzt, welche vorbereiteten Datensätze in die Vergleichsphase gelangen (Räumlichkeit, Layer, OSM-Scope).',
    compareFilterEmpty: 'Keine zusätzlichen Filterregeln im Report eingebettet.',
    compareNoCompareConfig:
      'Keine Abgleichskonfiguration im Report eingebettet (kein Filter-Summary oder Preset vorhanden).',
    compareIdNormalization: (...args: [string, string]) => {
      void args
      return `Legt fest, wie Rohwerte aus amtlichem Schlüsselfeld und OSM-Tag vor dem paarweisen Abgleich normalisiert werden.`
    },
    compareBoundaryTag: (value: string) =>
      `Im OSM-Extrakt und für Live-Anbindungen gilt \`boundary=${value}\`.`,
    compareBoundaryTagMultiple: (valuesCsv: string) =>
      `Im OSM-Extrakt und für Live-Anbindungen gelten \`boundary\`-Werte: ${valuesCsv}.`,
    compareAdminLevels: (levelsCsv: string) =>
      `Erwartete \`admin_level\`-Werte auf der OSM-Seite für diesen Datensatz: ${levelsCsv}.`,
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
      bboxFilter: {
        none: 'Es wird kein Bounding-Box-Filter vor dem Matching angewendet.',
        official_bbox_overlap:
          'OSM-Kandidaten werden räumlich auf den Bereich begrenzt, der die amtliche Abdeckung (plus Puffer) überlappt.',
      },
      bboxBufferDegrees: (value: number) =>
        `Erweitert den amtlichen Bounding-Box-Filter um ${value} Grad als Sicherheitsrand gegen Randabschneidungen.`,
      osmScopeFilter: {
        none: 'Es wird kein zusätzlicher räumlicher Scope-Filter auf OSM-Features angewendet.',
        intersects_official_coverage:
          'Amtliche Polygone werden zu einer gemeinsamen Referenzfläche (Vereinigung) zusammengeführt. Ein OSM-Objekt bleibt erhalten, wenn ein repräsentativer Punkt auf der OSM-Geometrie innerhalb dieser Fläche liegt; schlägt dieser Test fehl, nur noch eine starke Überlappung in der Metrik-CRS (Mindestfläche und Mindestanteil der OSM-Fläche, fest im Code) — schmale Randstreifen und reine Berührungen werden verworfen.',
      },
      ignoreRelationIds: 'Diese OSM-Relationen werden vor dem Matching explizit ausgeschlossen.',
      officialExtractFilter: (property: string, valuePrefix: string) =>
        `Der für den Vergleich verwendete amtliche Datensatz enthält nur Features, deren Feld \`${property}\` mit dem Präfix \`${valuePrefix}\` beginnt. OSM-only-Zeilen, deren Vergleichsschlüssel nicht mit diesem Präfix beginnt (z. B. Nachbar-Bundesländer), werden nicht als „Nur OSM“ gelistet.`,
      officialExtractExclude: (property: string, values: string[]) =>
        `Der für den Vergleich verwendete amtliche Datensatz enthält keine Features, deren Feld \`${property}\` einem dieser Werte entspricht: ${values.map((value) => `\`${value}\``).join(', ')}. Diese Features fehlen daher auf der amtlichen Seite des Vergleichs.`,
    },
    noSourceData: 'Keine Quellenangaben im Report enthalten.',
    osmFilterNoteTitle: 'Zusatzhinweis aus dem Build',
  },

  home: {
    processingStatusLink: 'Verarbeitungsstatus öffnen',
    changelogLinkLabel: 'Changelog',
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
      'Zugeordnet, nur amtlich, OSM ohne Treffer in offiziellen Daten, amtlicher Schlüssel veraltet, Prüfung, Problem — Anzahl',
    unmatchedStat: 'Nur OSM',
    staleOfficialKeyStat: 'Schlüssel veraltet',
    rowFlagStat: (label: string) => `davon ${label}`,
    reviewsStat: 'Prüfung',
    issuesStat: 'Problem',
    unmatchedLink: 'Liste: OSM ohne Treffer im amtlichen Export',
    /** Home list: theme headings above the dataset cards. */
    groupAdministrativeHeading: 'Verwaltungsgrenzen',
    groupPostalCodeHeading: 'Postleitzahlen',
    groupProtectedAreaHeading: 'Schutzgebiete',
    groupProtectedAreaLead: 'Vergleich mit den Schutzgebietsdaten von Digitize the Planet e.V.',
  },

  status: {
    breadcrumb: 'Verarbeitungsstatus',
    title: 'Verarbeitungsstatus',
    /** Keep in sync with .github/workflows/data-refresh.yml schedule (cron + timezone). */
    dataRefreshCadence:
      'Vergleich und veröffentlichte Auswertungen werden automatisch viermal pro Woche neu erstellt (sonntags, mittwochs, freitags und samstags jeweils um 04:00 Uhr Europe/Berlin). Diese Seite zeigt den aktuellen Stand der Verarbeitung.',
    backHome: '← Zurück zur Startseite',
    githubActionsLink: 'GitHub Actions',
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
    kpiHeading: 'Aktuelle Datenstände',
    kpiLastCompare: 'Letzter erfolgreicher Vergleich',
    kpiLastCompareHint: 'Pipeline-Phase „Vergleich“ abgeschlossen',
    kpiLastDownload: 'Letzter erfolgreicher Download',
    kpiLastDownloadHint: 'Pipeline-Phase „Download“ abgeschlossen',
    kpiLastPublished: 'Zuletzt veröffentlichte Auswertung',
    kpiLastPublishedHint: 'Neuester Datensatz-Vergleich oder abgeschlossener Lauf',
    timestampMissing: 'Noch nicht verfügbar',
    timelineHeading: 'Zeitleiste (10 Tage zurück und voraus)',
    timelineAria:
      'Kalenderzeile mit Pipeline-Läufen der letzten und nächsten zehn Tage; Marker verlinken zu Details unten',
    timelineToday: 'Heute',
    timelineScheduled: 'Geplant',
    timelineLegendDownload: 'Download',
    timelineLegendExtract: 'Extraktion',
    timelineLegendCompare: 'Vergleich',
    timelineLegendScheduled: 'Geplanter Lauf (04:00)',
    phaseDownload: 'Download',
    phaseExtract: 'Extraktion',
    phaseCompare: 'Vergleich',
    phaseAll: 'Gesamtlauf',
    phaseUnknown: 'Lauf',
    runDetailsHeading: 'Läufe im Zeitraum',
    olderRunsHeading: 'Ältere Läufe',
    runStatusBranchesHeading: 'Zweige (aktueller Lauf)',
    runStatusShared: 'Gemeinsame Schritte',
    runStatusAreas: 'Gebiete',
    compareOutputOrigin: 'Vergleichs-Output',
    compareOriginCurrent: 'Aktueller Lauf',
    compareOriginCache: 'Letzter guter Cache',
    compareOriginNone: 'Keiner',
    datasetsOkFail: '{ok} erfolgreich, {fail} fehlgeschlagen',
    statusOk: 'OK',
    statusFail: 'Fehler',
    statusSkipped: 'Übersprungen',
    loading: 'Lade Status…',
    osmAlertFailedTitle: 'OSM-Download fehlgeschlagen',
    osmAlertFailedDetailFallback:
      'Der Germany-PBF-Download ist fehlgeschlagen und es konnte kein Fallback-Cache wiederhergestellt werden.',
    osmAlertFallbackTitle: 'OSM-Daten nicht aktualisiert',
    osmAlertFallbackDetail:
      'Die Auswertung nutzt ältere OSM-Daten ({origin}). Ein frischer Download ist fehlgeschlagen.',
    osmAlertFreshAttemptError: 'Fehler beim frischen Download: {error}.',
    osmAlertFallbackStreak:
      'Fallback-Cache bereits {count}× hintereinander genutzt (Limit: {max} Läufe).',
    osmSourceOriginFresh: 'frisch heruntergeladen',
    osmSourceOriginCacheWindow: 'Cache im aktuellen Refresh-Fenster',
    osmSourceOriginFallback: 'Fallback-Cache aus vorherigem Lauf',
    osmSourceOriginUnknown: 'unbekannte Quelle',
    branchError: 'Fehler',
    branchSourceOrigin: 'Quelle',
  },

  changelog: {
    heading: 'Changelog',
    loading: 'Lade Changelog…',
    error: 'Changelog konnte nicht geladen werden.',
    empty: 'Noch keine Changelog-Einträge.',
  },

  /** GitHub issues with label `discussion`, linked by issue title = canonical page path (no query). */
  discuss: {
    buttonLabel: 'Datensatz diskutieren',
    modalTitle: 'Diskussion auf GitHub',
    modalLead: 'Hinweise oder vertiefende Fragen zu dieser Seite.',
    modalParagraphs: [
      'Über die Schaltfläche unten öffnen Sie das neue Issue auf GitHub — Label „discussion“ und der Issue-Titel (Seitenpfad ohne URL-Parameter) sind dabei bereits gesetzt.',
      'Technischer Hinweis: Die Verknüpfung zu dieser Seite entsteht, indem genau dieses Label und der Titel mit dem aktuellen Seitenpfad übereinstimmen. Ein Issue zu einer Vergleichsseite erscheint zusätzlich auf den Detailseiten beider Einträge.',
      'Nach dem nächsten Report-Lauf kann der Hinweis hier für andere sichtbar werden.',
    ],
    modalClose: 'Schließen',
    openNewIssue: 'Issue auf GitHub anlegen',
    alertTitle: 'Zu dieser Seite gibt es eine Diskussion auf GitHub.',
    /** Closed-issue alert: segments around <strong>geschlossene</strong>. */
    alertTitleClosedBefore: 'Zu dieser Seite gibt es eine ',
    alertTitleClosedEmphasis: 'geschlossene',
    alertTitleClosedAfter: ' Diskussion auf GitHub.',
    /** Prefix before open/closed in the alert status line, e.g. "Status: Offen · …". */
    alertStatusPrefix: 'Status',
    alertLastActive: (relativeTimeWithSuffix: string) => `Zuletzt aktiv ${relativeTimeWithSuffix}`,
    /** Shown when `discussions.registry.sync-meta.json` exists (successful sync). */
    alertLastChecked: (relativeTimeWithSuffix: string) =>
      `Zuletzt geprüft ${relativeTimeWithSuffix}`,
    openDiscussion: 'Auf Github lesen und kommentieren',
    stateOpen: 'Offen',
    stateClosed: 'Geschlossen',
  },

  /** Compare page of an official-only row and an unmatched OSM row of the same dataset. */
  compare: {
    buttonLabel: 'Vergleichen',
    metaTitle: (officialName: string, osmName: string) => `Vergleich ${officialName} ↔ ${osmName}`,
    heading: 'Vergleich',
    lead: 'Amtliche Fläche und OSM-Relation ohne Treffer nebeneinander. Passt die OSM-Relation, kann sie in OSM korrigiert werden; bleibt eine Abweichung, dokumentiert ein Issue zu diesem Vergleich beide Einträge zugleich.',
    openDetail: 'Detailseite',
    mapLegendOfficial: 'Amtliche Fläche',
    mapLegendOsm: 'OSM-Relation',
    invalidPair:
      'Dieser Vergleich ist nicht möglich. Links muss ein Eintrag ohne OSM-Treffer stehen, rechts eine OSM-Relation ohne Treffer, beide aus diesem Datensatz.',
    officialNotFound: (key: string) => `Kein Eintrag ohne OSM-Treffer mit dem Schlüssel ${key}.`,
    osmNotFound: (key: string) => `Keine OSM-Relation ohne Treffer mit dem Schlüssel ${key}.`,
    mapNoOsmTiles:
      'Für diesen Datensatz gibt es keine Kartenkacheln der OSM-Objekte ohne Treffer. Die OSM-Geometrie kann live geladen werden.',
    keysHeading: 'Abgleich der Regionalschlüssel',
    keysLead:
      'Beide Schlüssel nach Ebenen zerlegt und im Schlüsselverzeichnis nachgeschlagen. Abweichende Ebenen sind markiert.',
    keysColumnSegment: 'Ebene',
    keysColumnOfficial: 'Amtlich',
    keysColumnOsm: 'OSM',
    keysLoading: 'Lade Schlüsselverzeichnis…',
    keysNotFound: 'nicht im Verzeichnis',
    keysObsolete: (year: number) => `veraltet, zuletzt ${year}`,
    keysDiffer: 'abweichend',
    keysOpenExplorer: 'Im Explorer öffnen',
    discussButton: 'Vergleich diskutieren',
    /** The table stores no tags for OSM-only rows, so the attribute checks wait for the live load. */
    osmTagsNotLoadedHint:
      'Für diese OSM-Relation liegen hier nur Name und ID vor. Lade die aktuellen OSM-Daten, um die Attribute zu vergleichen.',
    discussBody: (compareUrl: string, officialUrl: string, osmUrl: string) =>
      [`Vergleich: ${compareUrl}`, '', `- ${officialUrl}`, `- ${osmUrl}`, ''].join('\n'),
    dialogTitle: 'Vergleichen mit …',
    dialogLeadOfficial: (areaName: string) =>
      `Wählen Sie eine OSM-Relation ohne Treffer dieses Vergleichs „${areaName}“.`,
    dialogLeadOsm: (areaName: string) =>
      `Wählen Sie einen Eintrag ohne OSM-Treffer dieses Vergleichs „${areaName}“.`,
    dialogCurrent: 'Diese Seite',
    dialogSuggested: 'Vorgeschlagen',
    dialogSuggestedHint: 'Kandidaten aus dem nächtlichen Abgleich.',
    dialogRecent: 'Zuletzt geöffnet',
    dialogRecentHint: (areaName: string) =>
      `Detailseiten dieses Vergleichs „${areaName}“, die Sie in den letzten 3 Stunden in einem Browser-Tab geöffnet hatten. Fehlt eine, öffnen Sie sie zuerst in einem Tab; die Liste aktualisiert sich dann von selbst.`,
    dialogRecentEmpty: 'Noch keine passende Detailseite geöffnet.',
    dialogClose: 'Schließen',
    dialogLoading: 'Lade Daten des Vergleichs…',
    openCompare: 'Vergleichen',
  },

  areaReport: {
    backAreas: '← Gebiete',
    chartTitle: meanIouChartDe.chartTitle,
    /** Freshness block heading (line 1). */
    freshnessHeadingReport: 'Auswertung',
    freshnessHeadingOsm: 'OSM Daten',
    freshnessSecondaryDownloadedPrefix: 'Download',
    freshnessSecondaryExtractedPrefix: 'Verarbeitet',
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
      category: 'Kategorie',
      ...areaReportTableMetricLabels,
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
      summaryLegendRowAria:
        'Legende: Zugeordnet, nur amtlich, nur OSM, amtlicher Schlüssel veraltet — Anzahl und Sichtbarkeit',
      staleOfficialKeyLabel: 'Schlüssel veraltet',
      staleKeysFilterLabel: 'Veraltete Schlüssel in der Tabelle',
      staleKeysAll: 'Alle',
      staleKeysOnly: 'Nur veraltet',
      staleKeysHide: 'Ohne veraltet',
      staleKeyBadge: 'amtlicher Schlüssel veraltet',
      rowFlagStat: (label: string) => `davon ${label}`,
      pairLinkToSuccessor: 'Zum aktuellen OSM-Schlüssel',
      pairLinkToPredecessor: 'Zum amtlichen Vorläufer-Schlüssel',
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
    /** Deep link to Schlüssel-Explorer from property rows and provenance. */
    germanKeyVerifyLink: 'Schlüssel-Explorer',
    rowFlagDetail: (label: string, value: string) => `${label}: ${value}`,
    regionalHubLink: 'Einwohner und Wikidata',
    stats: {
      /** Matches JSON field name; shown next to key value on the feature header row. */
      canonicalMatchKeyField: 'canonicalMatchKey',
      /** aria-label fragment for header key group including the canonical value. */
      canonicalMatchKeyGroupAria: 'Abgleichsschlüssel',
      ...areaReportTableMetricLabels,
      symDiff: 'Symmetrische Differenz',
      /** Narrow KPI column at `lg`; full phrase below `lg`. */
      symDiffShort: 'Symmetrische Diff.',
      /** KPI band: first column when there are no overlap metrics but the row is OSM-only or official-only. */
      unmatchedCompareLabel: 'Zuordnung',
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
    liveSourcesSectionTitle: 'Weitere Live-Daten',
    liveSourcesSectionLead:
      'Aktuelle Daten der amtlichen Quelle und PLZ-Punktdaten aus OSM im aktuellen Kartenausschnitt zum Vergleich.',
    liveOfficialHeading: 'Amtliche Quelle (WFS)',
    liveOfficialLoad: 'Eigenschaften laden',
    liveOfficialLoading: 'Wird geladen …',
    liveMapViewportPending:
      'Kartenausschnitt ist noch nicht bereit — bitte kurz warten oder die Karte leicht bewegen.',
    liveOfficialEmpty: 'Keine Treffer im Ausschnitt.',
    liveOfficialInvalidJson: 'Unerwartete WFS-Antwort (kein FeatureCollection).',
    liveOfficialUnsupportedFormat:
      'Diese WFS-Quelle liefert kein GeoJSON. Bitte ohne JSON-Format anfragen oder ein WFS/GML-Format nutzen.',
    liveOfficialHttp: 'WFS-Anfrage fehlgeschlagen:',
    liveOfficialFeatureTitle: (index1: number, id: string) =>
      `Datensatz ${index1}${id ? ` · ${id}` : ''}`,
    livePlzAddrRowHeading: 'PLZ-Punktdaten (addr:postcode)',
    liveOsmObjectLoad: 'Aktuellen Stand laden',
    liveOsmObjectLoading: 'Wird geladen …',
    liveOsmObjectReload: 'Neu laden',
    liveOsmObjectGone: 'Dieses Objekt gibt es in OSM nicht mehr (gelöscht?).',
    liveOsmObjectTagsHeading: 'Aktuell in OSM',
    /** Matched row: button next to the OSM attribute list. */
    liveOsmMatchedLoad: 'Aktuellen OSM-Stand laden',
    liveOsmChangedSinceExtract: (changes: string) => `Seit dem Extrakt geändert: ${changes}`,
    liveOsmUnchangedSinceExtract: 'Unverändert seit dem Extrakt',
    liveOsmChangeAdded: (key: string, after: string) => `${key} neu (${after})`,
    liveOsmChangeRemoved: (key: string, before: string) => `${key} entfernt (war ${before})`,
    liveOsmChangeChanged: (key: string, before: string, after: string) =>
      `${key}: ${before} → ${after}`,
    /** ∅ marker on a live OSM value that the official record lacks. */
    liveOsmCheckMissingReferenceTooltip: (source: string) => `fehlt bei ${source}`,
    /** ✓/≠ tooltips on live OSM tags: result of an attribute check against the official property. */
    liveOsmCheckEqualTooltip: (source: string, officialKey: string, officialValue: string) =>
      `gleich wie bei ${source} (${officialKey}: ${officialValue})`,
    liveOsmCheckDifferentTooltip: (source: string, officialKey: string, officialValue: string) =>
      `weicht von ${source} ab (${officialKey}: ${officialValue})`,
    liveOsmNearbySearch: 'Weitere OSM-Objekte in der Umgebung suchen',
    liveOsmNearbyBadge: 'aus der Umgebung',
    liveOsmNearbyAgain: 'Umgebungssuche erneut starten',
    liveOsmNearbyTruncated: (count: number) =>
      `Es werden nur die ersten ${count} Objekte gezeigt. Bitte weiter hineinzoomen.`,
    liveOsmNearbyEmpty: 'Keine weiteren OSM-Objekte im Kartenausschnitt gefunden.',
    liveOsmNearbyTags: (count: number) => `Tags (${count})`,
    liveOsmLastErrorTitle: 'Postpass-Fehler',
    liveOsmLastErrorHint:
      'Kartenausschnitt verkleinern und erneut laden, oder später noch einmal versuchen.',
    livePlzAddrPostcodeButton: 'PLZ-Punktdaten im Gebiet anzeigen',
    livePlzAddrPostcodeLead:
      'Zum Vergleich der Flächen-Daten kannst du dir die `addr:postcode`-Daten an Punkt- und Flächen-Daten im Kartenausschnitt anzeigen lassen.',
    livePlzAddrColorHint: 'Farbe nach letzter PLZ-Ziffer (0–9).',
    livePlzAddrLoading: 'Postpass lädt `addr:postcode` …',
    livePlzAddrEmpty: 'Keine Treffer mit `addr:postcode` in diesem Kartenausschnitt.',
    livePlzAddrLastErrorTitle: 'Postpass-Fehler',
    livePlzAddrLastErrorHint:
      'Kartenausschnitt verkleinern und erneut laden, oder später noch einmal versuchen.',
    livePlzAddrAgain: 'PLZ-Punktdaten erneut laden',
    livePlzAddrTruncated: (count: number) =>
      `Es werden nur die ersten ${count} Adressen gezeigt. Bitte weiter hineinzoomen.`,
    livePlzAddrCardsCapped: (shown: number, total: number) =>
      `Liste zeigt ${shown} von ${total} Adressen, die Karte alle.`,
    livePlzAddrHitTitle: (osmType: string, id: number, postcode: string) =>
      `${postcode} · ${osmType} ${id}`,
    liveOsmLoading: 'Postpass antwortet …',
    liveOsmHitNoTags: '(keine Tags)',
    liveOsmInvalidJson: 'Unerwartete Postpass-Antwort.',
    liveOsmHttp: 'Postpass-Anfrage fehlgeschlagen:',
    liveOsmTimeout:
      'Postpass hat nicht innerhalb von 20 Sekunden geantwortet. Bitte später erneut versuchen.',
    liveOsmTooMuchData: 'Zu viele Daten in diesem Kartenausschnitt. Bitte weiter hineinzoomen.',
    liveOsmHitTitle: (osmType: string, id: number) => `${osmType} ${id}`,
    liveRowShowOnMap: 'Auf der Karte einblenden',
    liveRowHideOnMap: 'Auf der Karte ausblenden',
    liveRowShowOnlyThis: 'Nur diesen zeigen',
    liveRowShowOnlyThisAria: 'Alle anderen Treffer auf der Karte ausblenden',
    liveSectionHideAll: 'Alle ausblenden',
    liveSectionShowAll: 'Alle einblenden',
    liveSectionHideAllAria: 'Alle Treffer auf der Karte ausblenden',
    liveSectionShowAllAria: 'Alle Treffer auf der Karte einblenden',
    liveOsmHitOpenLink: 'osm.org',
    liveOsmHitOpenLinkAria: (osmType: string, id: number) => `${osmType} ${id} auf osm.org öffnen`,
    liveOsmHitOpenBoundaryChecker: (osmType: string, id: number) =>
      `Grenzabgleich für ${osmType} ${id} öffnen`,
    liveOsmHitOpenBoundaryCheckerAria: (osmType: string, id: number) =>
      `${osmType} ${id} im Grenzabgleich öffnen`,

    datasetPropertiesSectionAria: 'Attribute aus dem Vergleich (amtlich und OSM)',
    datasetPropertiesSectionTitle: 'Attribute zum Zeitpunkt des Vergleichs',
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
    /** Modal: official dataset age, opened from the summary info button or "Alter anzeigen" in dataset properties. */
    officialDatasetAge: {
      triggerAria: 'Datenstand der amtlichen Daten anzeigen',
      linkLabel: 'Alter anzeigen',
      modalTitle: 'Datenstand: Amtliche Daten',
      sourceDateExplanation:
        'Vom Anbieter angegebenes Referenzdatum des Datensatzes (z. B. Stand 31.12. eines Jahres).',
      checkedDateExplanation:
        'Zeitpunkt, zu dem die Pipeline zuletzt geprüft hat, ob beim Anbieter ein neueres Referenzdatum vorliegt.',
      geometryFetchedExplanation:
        'Zeitpunkt, zu dem die Geometrie des Datensatzes zuletzt heruntergeladen und in die Auswertung übernommen wurde.',
      close: 'Schließen',
    },
    datasetOsmOpenHistory: 'Auf osm.org anzeigen',
    datasetPropertiesEmpty: '—',
    datasetOsmNone: 'Kein OSM-Objekt zugeordnet',
    datasetOsmCandidateSelectLabel: 'Kandidat anzeigen',
    datasetOsmCandidateTagsLabel: 'OSM-Kandidat (Auszug aus dem Vergleichsextrakt)',
    /** Attribute checks (config `compare.attributeChecks`): marker tooltips and summary chips. */
    datasetAttributeCheckEqualTooltip: (osmPairs: string) => `gleich in OSM: ${osmPairs}`,
    datasetAttributeCheckDifferentTooltip: (osmPairs: string) => `OSM: ${osmPairs}`,
    datasetAttributeCheckEqualChip: (label: string) => `${label} gleich`,
    datasetAttributeCheckCombinedNameRule: 'kombinierte Namensregel',
    datasetAttributeCheckEqualTooltipNoPairs: 'gleich in OSM',
    datasetAttributeCheckExpectedTooltip: (tags: string) => `erwartet: ${tags}`,
    /** Chip "+ <label> fehlt in OSM: key=value" (the tag follows as code with a copy button). */
    datasetAttributeCheckMissingOsmChip: (label: string) => `${label} fehlt in OSM`,
    /** `source` is the dative source wording ("DtP", "den amtlichen Daten"); `osmValues` what OSM has. */
    datasetAttributeCheckMissingReferenceChip: (label: string, source: string, osmValues: string) =>
      `${label} fehlt bei ${source} (OSM: ${osmValues})`,
    datasetAttributeCheckMissingOsmTooltip: 'fehlt in OSM',
    datasetAttributeCheckMissingReferenceTooltip: (source: string) => `fehlt bei ${source}`,
    datasetAttributeCheckCopyAria: (label: string) => `Vorgeschlagene Tags für ${label} kopieren`,
    datasetAttributeChecksAria: 'Ergebnis der Attributprüfung',

    /** Wikidata row inside "Attribute zum Zeitpunkt des Vergleichs" (dataset option `compare.wikidata`). */
    wikidata: {
      title: 'Wikidata',
      lead: 'Wikidata-Objekt, das die Daten oder OSM über den wikidata-Wert nennen.',
      none: 'Kein Wikidata-Objekt verknüpft',
      edit: 'In Wikidata bearbeiten',
      notFound:
        'Objekt in den abgerufenen Wikidata-Daten nicht gefunden (gelöscht oder umgeleitet?).',
      viaOfficial: (dataHeading: string) => `Laut ${dataHeading}`,
      viaOsm: 'Laut OSM-Tag wikidata',
      missing: 'fehlt',
      missingAdd: 'fehlt – ergänzen:',
      equalTooltip: 'gleich',
      differentTooltip: 'weicht ab',
      areaUnit: 'ha',
      fields: {
        label: 'Bezeichnung (Label, de)',
        wdpa: 'WDPA-ID',
        osmRelation: 'OSM-Relations-ID',
        website: 'Website',
        operator: 'Betreiber',
        area: 'Fläche',
        commons: 'Commons-Kategorie',
      },
      properties: {
        label: '',
        wdpa: 'P809',
        osmRelation: 'P402',
        website: 'P856',
        operator: 'P137',
        area: 'P2046',
        commons: 'P373',
      },
    },

    /** Live-Abruf row inside "Attribute zum Zeitpunkt des Vergleichs". */
    datasetOsmLiveCardTitle: 'OSM-Daten (Live-Abruf)',
    /** Hint shown above the live OSM tags to clarify the comparison purpose. */
    datasetOsmLiveCompareHint: (officialDataHeading: string) =>
      `Nutze diese Funktion um weitere Werte aus den „${officialDataHeading}“ oben mit OSM Daten abzugleichen.`,
    datasetOsmLiveQueryLabel: 'Datenstand OSM',
    datasetOsmLiveLoading: 'Postpass antwortet …',
    datasetOsmLiveEmpty: 'OSM-Objekt nicht gefunden oder ohne Tags.',
    datasetOsmLiveAgain: 'Erneut abfragen',
    /** 3rd column status: OSM live tag matches the value in the filtered official record. */
    datasetOsmLiveCompareMatchTooltip: 'Stimmt mit amtlichen Daten überein',
    /** 3rd column status: key from filtered official is missing in OSM live. Renders <code>{wert}</code> between prefix and suffix. */
    datasetOsmLiveCompareMissingPrefix: 'Wert',
    datasetOsmLiveCompareMissingSuffix: 'der amtlichen Daten könnte ergänzt werden.',
    /** Separate informational block for official indicators that help verification but are not 1:1 OSM tags. */
    datasetIndicatorsHeading: 'Hinweise zur Verifizierung',
    datasetIndicatorsLead:
      'Diese Felder werden nicht direkt gegen OSM-Tags verglichen, können aber zur Plausibilitätsprüfung genutzt werden.',
    datasetIndicatorDescBEM:
      'Bemerkung zur administrativen Einordnung (z. B. kreisfrei) als Kontext für die Prüfung.',
    datasetIndicatorDescBEZ:
      'Bezeichnung der Verwaltungseinheit (z. B. Stadt/Gemeinde/Landkreis) zur Typ-Validierung.',
    datasetIndicatorDescBSG:
      'Sondergebiets-Kennzeichnung (z. B. Bodensee/Hoheitsgebiet) für Ausnahmefälle.',
    datasetIndicatorDescNBD:
      'Kennzeichnet, ob die Bezeichnung Bestandteil des amtlichen Namens ist (Namensprüfung).',

    /** Detail page of a DtP row: suggest a correction to DtP, and show a reviewed override. */
    dtpCorrection: {
      sectionAria: 'Korrektur für Digitize the Planet vorschlagen',
      heading: 'Daten bei DtP korrigieren',
      lead: 'Manchmal liegt der Fehler nicht in OSM, sondern bei Digitize the Planet, etwa ein falscher OSM-Verweis oder eine fehlende Wikidata-ID. Dann schlage hier eine Korrektur vor.',
      linkLabel: 'Korrektur für DtP vorschlagen',
      /** Notice above the lead, when a reviewed correction of ours applies to this row. */
      noticeTitle: 'Für dieses Gebiet gilt unsere eigene Korrektur, die wir DtP vorschlagen.',
      noticeReportedOsm: (ref: string) => `DtP nennt als OSM-Objekt: ${ref}.`,
      noticeNoReportedOsm: 'DtP nennt kein OSM-Objekt.',
      noticeUsedOsm: (ref: string) => `Wir nutzen: ${ref}.`,
      noticeNoUsedOsm: 'Wir nutzen kein OSM-Objekt.',
      noticeWikidataNone: (used: string) => `DtP nennt keine Wikidata-ID; wir nutzen ${used}.`,
      noticeWikidataReported: (reported: string, used: string) =>
        `DtP nennt ${reported}; wir nutzen ${used}.`,
      noticeComment: (comment: string) => `Begründung: ${comment}`,
      /** `override_impact` of the override file. */
      noticeImpact: {
        matching:
          'Wichtig für den Abgleich: Ohne diese Korrektur landet das Gebiet beim falschen oder bei keinem OSM-Objekt.',
        informational: 'Zur Information: Der Abgleich stimmt auch ohne diese Korrektur.',
      },
    },

    staleOfficialKeySectionAria: 'Amtlicher Schlüssel ist veraltet',
    staleOfficialKeyTitle: 'Amtlicher Schlüssel veraltet',
    staleOfficialKeyLead:
      'Der amtliche VG25-Stand enthält noch den alten Regionalschlüssel. Destatis und OpenStreetMap nutzen bereits den neuen Schlüssel. Für den Schlüssel ist keine OSM-Änderung nötig.',
    staleOfficialKeyOfficialLabel: (stand: string | null) =>
      stand ? `Amtlich (VG25, ${stand})` : 'Amtlich (VG25)',
    staleOfficialKeyCurrentLabel: (opts: {
      destatisStand: string | null
      osmStand: string | null
      keySince: string | null
    }) => {
      const destatis = opts.destatisStand ? `Destatis, ${opts.destatisStand}` : 'Destatis'
      const osm = opts.osmStand ? `OSM, ${opts.osmStand}` : 'OSM'
      const core = `${destatis} / ${osm}`
      if (opts.keySince) return `Heute (${core} — seit ${opts.keySince})`
      return `Heute (${core})`
    },
    staleOfficialKeyNoEditHint: 'Bitte nicht den alten amtlichen Schlüssel nach OSM schreiben.',
    disjointGeometryNoticeAria: 'Flächen überschneiden sich nicht',
    disjointGeometryNoticeLead: (opts: {
      areaLabel: string
      distanceKm: string
      matchProperty: string
      dataLabel: string
    }) =>
      `Die ${opts.areaLabel} und die OSM-Fläche überschneiden sich nicht und liegen bis zu ${opts.distanceKm} km auseinander. Vermutlich ist der Schlüssel (${opts.matchProperty}) in OSM oder in den ${opts.dataLabel} falsch.`,
    disjointGeometryZoomToArea: (areaLabel: string) => `Zur ${areaLabel}`,
    disjointGeometryZoomToOsm: 'Zur OSM-Fläche',
    decodeKeyExplorerLink: 'Schlüssel-Felder dekodieren',

    candidatesSectionAria: 'OSM-Matching-Kandidaten für diese amtliche Grenze',
    candidatesSectionTitle: 'OSM-Matching-Kandidaten',
    /** OSM tag names only (no „…“); joined with „“, „" in the caller. */
    candidatesSectionLeadCore: (osmTagsJoined: string, officialMatchProperty: string) =>
      `Kandidaten sind OSM-Objekte, die zum amtlichen Datensatz passen könnten, aber beim Abgleich über die OSM-Match-Tags „${osmTagsJoined}“ mit dem amtlichen Feld „${officialMatchProperty}“ nicht zugeordnet werden konnten.`,
    candidatesSectionLeadChecksPostal: () =>
      'Geprüft wird: Multipolygone mit boundary=postal_code und gesetztem postal_code-Tag auf dem Kandidaten; der repräsentative Innenpunkt (Point-on-surface) liegt im amtlichen Polygon (linear auf 70 % verkleinert). So lassen sich fehlende oder fehlerhafte Tags schneller finden.',
    candidatesSectionLeadChecksAdminListed: (adminLevelsJoined: string) =>
      `Geprüft wird: Multipolygone mit boundary=administrative, admin_level in {${adminLevelsJoined}}; der repräsentative Innenpunkt (Point-on-surface) liegt im amtlichen Polygon (linear auf 70 % verkleinert). So lassen sich fehlende oder fehlerhafte Tags schneller finden.`,
    candidatesSectionLeadChecksAdminGeneric: () =>
      'Geprüft wird: Multipolygone mit boundary=administrative und ein zur Datensatz-Konfiguration passendes admin_level; der repräsentative Innenpunkt (Point-on-surface) liegt im amtlichen Polygon (linear auf 70 % verkleinert). So lassen sich fehlende oder fehlerhafte Tags schneller finden.',
    candidatesSectionMatchHintBeforePostal: () =>
      'Zur Zuordnung dieser amtlichen Daten prüfen Sie die passende OSM-Fläche mit boundary=postal_code und erwägen Sie, sie mit dem Tag',
    candidatesSectionMatchHintBeforeAdmin: () =>
      'Zur Zuordnung dieser amtlichen Daten prüfen Sie die passende administrative Grenze in OSM (boundary=administrative) und erwägen Sie, sie mit dem Tag',
    candidatesSectionMatchHintAfter: () => 'zu versehen.',
    candidatesSectionStaleHint:
      'Der räumliche Kandidat trägt bereits den aktuellen Regionalschlüssel. Den alten amtlichen Schlüssel nicht nach OSM übernehmen.',
    candidatesEmpty: 'Keine Kandidaten gefunden.',
    candidatesExpectedTagsLead: 'Ein OSM-Objekt für dieses Gebiet sollte diese Tags tragen:',
    candidatesColumnObject: 'OSM-Objekt',
    candidatesColumnName: 'Name',
    candidatesColumnAdminLevel: 'admin_level',
    candidatesColumnPostalCode: 'postal_code',
    candidatesColumnDeRs: 'de:regionalschluessel',
    candidatesColumnActions: 'Aktionen',
    candidatesEditLink: 'In iD bearbeiten',
    candidatesViewLink: 'Auf osm.org',
    candidatesNoName: '(ohne Name)',
    candidatesEmptyValue: '–',

    protectedCandidatesLead:
      'Diese OSM-Objekte könnten diese DtP-Fläche sein, sind ihr aber noch nicht zugeordnet; die stärksten Kandidaten stehen oben.',
    protectedCandidatesDetectedVia: 'Erkannt über:',
    protectedCandidatesCta: 'Wenn dies dasselbe Gebiet ist, ergänze in OSM:',
    /** Note next to a suggested `dtp_id` tag; `linkText` links to the tag's taginfo page. */
    protectedCandidatesDtpIdNote: {
      before: 'dtp_id ist in OSM in Gebrauch (ca. 425 Objekte), aber ',
      linkText: 'nicht dokumentiert',
      after: '; besser die Verknüpfung über wikidata nutzen.',
      href: 'https://taginfo.openstreetmap.org/keys/dtp_id',
    },
    protectedCandidatesColumnCurrent: 'Aktuell in OSM:',
    protectedCandidatesCurrentNone: 'keine Typ-Tags',
    protectedCandidatesSignal: {
      dtp_id: 'dtp_id',
      dtp_osm_ref: 'DtP-OSM-Verweis',
      wikidata: 'Wikidata',
      natura2000: 'Natura 2000',
      inside: 'Lage + Typ',
      name: 'Name',
    },
    protectedCandidatesSignalTitle: {
      dtp_id: 'Das OSM-Objekt trägt die DtP-Kennung (dtp_id) dieses Gebiets.',
      dtp_osm_ref: 'Digitize the Planet verweist selbst auf dieses OSM-Objekt.',
      wikidata: 'Beide Seiten haben dieselbe Wikidata-ID.',
      natura2000: 'Beide Seiten haben denselben Natura-2000-Gebietscode.',
      inside: 'Das OSM-Objekt liegt in der DtP-Fläche und hat passende Schutzgebiets-Tags.',
      name: 'Die Namen sind ähnlich.',
    },
    protectedCandidatesSignalNameTitle: (percent: number) =>
      `Die Namen sind ähnlich (${percent} %).`,
    copyTags: 'Tags kopieren',
    copyTagsDone: 'Kopiert',
    copyTagsAria: (osmObject: string) => `Vorgeschlagene Tags für ${osmObject} kopieren`,

    /** Hints without an attribute check (shard `attributeHints`), shown as chips in the attribute block. */
    attributeHints: {
      osmRefDiffers: 'DtP verweist auf ein anderes OSM-Objekt',
      osmRefDiffersTooltip: (expected: string, actual: string) =>
        `DtP nennt ${expected}, zugeordnet ist ${actual}`,
    },

    updateMap: {
      title: 'Daten in OSM bearbeiten',
      licenceUnknownLinkSentence: 'Die Lizenz der amtlichen Daten ist unbekannt.',
      licenceNoLinkBeforeBold: 'Für diese Daten besteht ',
      licenceNoLinkBoldKeine: 'keine',
      licenceNoLinkAfterBold: ' Freigabe zur Nutzung in OSM.',
      licenceResearchOnlyDisclaimer:
        'Dieser Abgleich darf daher nur als Basis für eine eigene Recherche genutzt werden.',
      osmBrowseHeading: 'Auf osm.org',
      openOsmOrg: 'OSM-Objekt auf osm.org öffnen',
      openOsmOrgDisabledHint: 'Für diesen Eintrag ist kein OSM-Objekt hinterlegt.',
      idHeading: 'iD-Editor',
      josmHeading: 'JOSM (Remote Control)',
      downloadOfficial: 'GeoJSON herunterladen',
      downloadOfficialDisabledHint: 'Für diese Detailansicht gibt es keine amtliche Geometrie.',
      /** No edit GeoJSON was built because the licence rules out OSM (`compare.officialForEdit`). */
      downloadOfficialLicenceHint:
        'Keine Datei: Die Lizenz dieses Gebiets erlaubt keine Übernahme in OSM.',
      /** No edit GeoJSON for rows rated ok (`needsOfficialForEditFile`). */
      downloadOfficialOkHint:
        'Keine Datei: Die Abweichung ist gering (Bewertung „OK“). GeoJSON gibt es nur für Gebiete mit „Prüfung“ oder „Problem“ und für Gebiete ohne OSM-Treffer.',
      downloadOfficialHint:
        'Datei enthält u. a. Namen, Schlüssel und Felder wie `officialSource.provider`, `officialSource.dataset`, `officialSource.sourcePublicUrl` usw., sofern beim Vergleich hinterlegt.',
      downloadOfficialPipelineHint:
        'Hinweis: Beim Export werden die Umringe leicht vereinfacht (ca. 2,5 m Toleranz) und Koordinaten auf sechs Nachkommastellen gerundet — für überschaubare Dateigröße in iD/JOSM.',
      revealHintAriaLabel: 'Hinweis anzeigen',
      opensInNewWindowTitle: 'Öffnet in einem neuen Browser-Tab',
      idDisableFeaturesHint:
        'Hinweis: In iD werden u. a. Gebäude, Wege und Bahn usw. ausgeblendet; Grenzen, Gewässer und übergeordnete Straßen bleiben sichtbar. Wichtig: Es kann sein, dass einzelne Punkte in dieser Ansicht nicht verschoben werden können. Wenn das passiert, musst du die Filtereinstellungen ändern und bspw. die Landnutzung einschalten. Denn diese Situation bedeutet, dass die Grenze mit einem Element verklebt ist, das zur Zeit versteckt ist — und daher darf sie nicht „blind“ verschoben werden. In diesem Fall dann die Verklebung lösen und die Elemente getrennt voneinander behandeln.',
      josmRemoteLead:
        'Remote Control in den JOSM-Einstellungen aktivieren. Links rufen JOSM lokal auf (Port 8111).',
      josmLoadObject: 'OSM-Objekt in JOSM laden',
      josmLoadObjectTitle: 'OSM-Objekt in JOSM laden (Remote Control: load_object)',
      josmImportDisabledHint:
        'Kein amtlicher GeoJSON-Export — zuerst Vergleich mit amtlicher Geometrie oder aktuelle Auswertung (ohne Snapshot) nutzen.',
      josmImportFallback:
        'Falls Import per URL fehlschlägt: GeoJSON herunterladen und in JOSM über Datei öffnen.',
      tableHint:
        'Diese comparison_table.json enthält noch kein Feld officialForEditPath — bitte den Vergleich erneut ausführen, um die GeoJSON-Exports zu erzeugen.',
    },
  },

  regionalHub: {
    metaTitle: 'Regionalschlüssel — Einwohner und Wikidata',
    title: 'Regionalschlüssel — Einwohner und Wikidata',
    lead: 'Vergleiche Destatis-Einwohnerzahl, OSM-Tags und Wikidata für eine Verwaltungseinheit. Die Seite ist zum Prüfen der Daten da — und dazu, OSM und Wikidata zu verbessern, wenn sie hinter der amtlichen Referenz zurückbleiben.',
    provenanceLine: (destatis: string, osm: string, wikidata: string) =>
      `Destatis ${destatis} · OSM-Extract ${osm} · Wikidata ${wikidata}`,
    provenanceUnknown: 'unbekannt',
    decodeLink: 'Schlüssel dekodieren',
    geometryLink: 'Grenzen im Datensatz',
    statistikportalLink: 'Statistikportal',
    sourcesDebugLink: 'Quellen (Debug)',
    searchLabel: 'Schlüssel oder Gemeinde-Name',
    searchPlaceholder: 'z. B. 120510000000, Flensburg',
    searchSubmit: 'Anzeigen',
    searchNoResults:
      'Kein Treffer. Für Namenssuche mindestens zwei Zeichen eingeben; für Schlüssel die Ziffern nutzen.',
    searchPickTitle: 'Mehrere Treffer',
    searchPickLead: 'Bitte einen Eintrag auswählen.',
    searchPickApply: 'Übernehmen',
    searchPickClose: 'Schließen',
    emptyBrowse: 'Kein Treffer in dieser Auswahl.',
    landCountTotal: (n: string) => `${n} gesamt`,
    landCountAction: (n: string) => `${n} Handlungsbedarf`,
    landAccordionHint: 'Ein Bundesland öffnen, um Kreise und Gemeinden zu listen.',
    statusOsmWikidata: 'Wikidata-Tag',
    statusOsmPopulation: 'OSM-Einwohner',
    statusWikidataPopulation: 'Wikidata-Einwohner',
    statusWikidataP402: 'Wikidata P402',
    colDestatis: 'Destatis',
    colOsm: 'OSM',
    colWikidata: 'Wikidata',
    rowPopulation: 'Einwohner',
    rowDate: 'Stichtag',
    rowArea: 'Fläche',
    rowWikidataId: 'Wikidata-ID',
    rowOsmRelation: 'OSM-Relation',
    latestChip: 'aktuellste Zahl',
    missingValue: '—',
    cellNa: 'n. a.',
    cellNaTitle: 'Nicht Teil dieser Quelle.',
    cellNaDestatisQid: 'Destatis führt keine Wikidata-IDs.',
    cellNaDestatisOsm: 'Destatis führt keine OSM-Relationen.',
    cellNaOsmArea: 'OSM-Fläche ist nicht Teil dieses Vergleichs.',
    cellNaWdArea: 'Wikidata-Fläche wird hier nicht ausgewertet.',
    cellMissing: 'fehlt',
    cellMissingTitle: 'Wert erwartet, liegt aber nicht vor.',
    cellWdNoP1388: 'kein P1388',
    cellWdNoP1388Title: (qid: string) =>
      `Die Wikidata-Spalte zeigt das Objekt, das diesen Regionalschlüssel als P1388 trägt. ${qid} (aus OSM) hat diesen Schlüssel nicht — das Tag ist nicht falsch formatiert.`,
    cellOptionalTitle: 'Nicht immer vorhanden.',
    tableLegend:
      'n. a. = nicht Teil dieser Quelle · fehlt = erwartet, aber leer · — = nicht immer gesetzt',
    tableToneLegend:
      'Grün = stimmt mit Destatis überein · Bernstein = weicht ab oder fehlt (wie der Hinweis oben)',
    cellToneOkTitle: 'Passt zum Abgleich',
    cellToneBadTitle: 'Weicht ab oder fehlt',
    cellToneRefTitle: 'Amtliche Referenz',
    noOfficialPopulation: 'Keine amtliche Einwohnerzahl in der aktuellen Quartalsdatei.',
    obsoleteLead: (year: number) =>
      `Dieser Schlüssel steht nicht in der aktuellen Quartalsdatei (zuletzt GV100ADJ ${year}).`,
    unknownLead: 'Dieser Regionalschlüssel ist im aktuellen Gemeindeverzeichnis nicht enthalten.',
    verdictOk: 'Einwohnerzahl stimmt mit Destatis überein.',
    verdictOsmWikidataMissing:
      'OSM hat noch kein wikidata-Tag, Wikidata kennt diesen Schlüssel eindeutig.',
    verdictOsmWikidataMismatch:
      'OSM-wikidata-Tag und Wikidata-Objekt zum Regionalschlüssel stimmen nicht überein.',
    verdictOsmPopulation: 'OSM-Einwohnerzahl oder Stichtag weicht von Destatis ab oder fehlt.',
    verdictWikidataPopulation:
      'Wikidata-Bevölkerung (P1082) weicht von Destatis ab oder ist älter.',
    verdictWikidataP402: 'Wikidata hat noch keine (passende) OSM-Relation (P402).',
    actionsTitle: 'Daten ändern',
    actionsLead:
      'Editor öffnen, Angaben dort prüfen, dann speichern. Diese Seite ändert nichts von selbst.',
    actionsOsmHintsLead: 'In OSM eintragen:',
    actionsWdHintsLead: 'In Wikidata eintragen:',
    actionsWdPopHint: (pop: string, date: string) =>
      `Bevölkerung (P1082) ${pop} zum Stichtag ${date}`,
    actionsWdP402Hint: (osmId: string) => `OSM-Relation (P402) ${osmId}`,
    actionsWdP1388Hint: (qid: string, ars: string) => `Regionalschlüssel (P1388) ${ars} an ${qid}`,
    idEdit: 'In iD öffnen',
    josmEdit: 'In JOSM öffnen',
    wdEdit: 'Auf Wikidata öffnen',
    liveTagsTitle: 'Aktuelle OSM-Tags (Postpass)',
    liveTagsButton: 'Tags erneut laden',
    liveTagsLoading: 'Postpass lädt …',
    liveTagsError: 'Postpass-Anfrage fehlgeschlagen.',
    successorCta: 'Nachfolger öffnen',
    sourcesTitle: 'Regionalhub — Quellen',
    sourcesLead:
      'Pipeline-Status für Destatis-Lookup, OSM-Tag-Sidecar und Wikidata-SPARQL. Keine Mapper-Aktionen.',
    sourcesSparql: 'SPARQL (BestRank + MAX P585)',
    sampleParse: 'Beispiel satzart 60 (Brandenburg an der Havel)',
    detailNotFoundTitle: 'Schlüssel unbekannt',
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
    /** Obsolete notice, case: the key's own segment is obsolete (the key itself is no longer listed). */
    obsoleteKeyHeading: 'Veralteter Schlüssel',
    obsoleteKeyLeadBeforeLink: (year: number) =>
      `Dieser Schlüssel steht nicht mehr im aktuellen Gemeindeverzeichnis. Zuletzt enthalten war er in der Jahresausgabe zum 31.12.${year} (`,
    obsoleteKeyLeadAfterLink:
      '). Das Gebiet wurde danach aufgelöst, zusammengelegt oder neu nummeriert.',
    obsoleteKeyOsmLead:
      'Dieser Schlüssel sollte nicht mehr vorkommen. Trägt eine Relation ihn, prüfen Sie, ob es das Gebiet noch gibt:',
    obsoleteKeyOsmYesLabel: 'Ja:',
    obsoleteKeyOsmYesText:
      'Ersetzen Sie den Schlüssel durch den aktuellen (siehe Nachfolger, falls angezeigt).',
    obsoleteKeyOsmNoLabel: 'Nein',
    obsoleteKeyOsmNoText:
      '(z.B. aufgelöste Verwaltungsgemeinschaft oder erfüllende Gemeinde): Löschen Sie die Relation.',
    /** Obsolete notice, case: only a higher segment of the key is obsolete. */
    obsoleteParentLead:
      'Ein Teil dieses Schlüssels (z.B. ein früherer Kreis) ist nur in älteren Ausgaben des Gemeindeverzeichnisses enthalten.',
    obsoleteNoticeYearBadge: (year: number) => `31.12.${year}:`,
    obsoleteNoticePublicationLink: 'Destatis-Publikationsseite',
    obsoleteYearSuffix: (year: number) => `nur GV100ADJ bis ${year}`,
    /** Shared label for "In OSM:" paragraphs in the obsolete and pseudo-Verband notices. */
    inOsmLabel: 'In OSM:',
    overpassSearchLabel: 'Relationen mit diesem Schlüssel in OSM suchen (Overpass)',
    /** Pseudo-Verband notice (input stops at Verband level, e.g. 160720015000). */
    pseudoVerbandHeading: {
      gemeinschaftsfrei: 'Pseudo-Verband (gemeinschaftsfreie Gemeinde)',
      gemeindefrei: 'Pseudo-Verband (gemeindefreies Gebiet)',
    },
    pseudoVerbandIntro:
      'Dieser Schlüssel beschreibt keine eigene Verwaltungseinheit und kein eigenes Gebiet. Destatis und BKG vergeben ihn nur, damit auch Gemeinden ohne Verwaltungsgemeinschaft, Amt oder Verbandsgemeinde einen vollständigen Verbandsteil im Regionalschlüssel haben.',
    pseudoVerbandAreaLead: {
      gemeinschaftsfrei: 'Die Fläche ist identisch mit der Gemeinde',
      gemeindefrei: 'Die Fläche ist identisch mit dem gemeindefreien Gebiet',
    },
    pseudoVerbandOsmBeforeTag: {
      gemeinschaftsfrei:
        'Dieser Schlüssel sollte an keiner Grenzrelation stehen. Trägt eine Relation (meist admin_level 7) diesen Schlüssel, ist sie ein Duplikat der Gemeinde und kann gelöscht werden. Prüfen Sie vorher, ob Tags wie',
      gemeindefrei:
        'Dieser Schlüssel sollte an keiner Grenzrelation stehen. Trägt eine Relation (meist admin_level 7) diesen Schlüssel, ist sie ein Duplikat des gemeindefreien Gebiets und kann gelöscht werden. Prüfen Sie vorher, ob Tags wie',
    },
    pseudoVerbandOsmAfterTag: {
      gemeinschaftsfrei: 'an die Gemeinde-Relation gehören.',
      gemeindefrei: 'an dessen Relation gehören.',
    },
    pseudoVerbandOpenLabel: {
      gemeinschaftsfrei: (ars12: string) => `Gemeinde ${ars12} öffnen`,
      gemeindefrei: (ars12: string) => `Gebiet ${ars12} öffnen`,
    },
    /** Short amber suffix after the name in the segments table and key overview. */
    pseudoVerbandSuffix: {
      gemeinschaftsfrei: 'Pseudo-Verband, gemeinschaftsfreie Gemeinde',
      gemeindefrei: 'Pseudo-Verband, gemeindefreies Gebiet',
    },
    successorCalloutFrom: (validFrom: string) =>
      `Dieser Schlüssel wurde zum ${validFrom} durch einen neuen Regionalschlüssel ersetzt.`,
    successorCalloutTo: (validFrom: string) =>
      `Dieser Schlüssel gilt seit ${validFrom} und ersetzt einen älteren Regionalschlüssel.`,
    successorCalloutOtherKey: 'Anderer Schlüssel',
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
    submitUrl: 'Aktualisieren',
    arsTableTitle: 'Regionalschlüssel (12 Stellen, ARS)',
    /** Headline used when the input is exactly 8 digits and the segments table renders the AGS view. */
    agsTableTitle: 'Gemeindeschlüssel / AGS (8 Stellen)',
    segmentBl: 'Bundesland',
    segmentRb: 'Regierungsbezirk',
    segmentKreis: 'Kreis / kreisfreie Stadt',
    segmentVg: 'Gemeindeverband',
    segmentGem: 'Gemeinde',
    noRegierungsbezirk: 'Kein Regierungsbezirk',
    noGemeindeverband: 'Kein Gemeindeverband',
    /** Segments table: cell labels for partially padded / out-of-input slots and lookup misses. */
    segmentNotInKey: 'Ebene nicht im Schlüssel enthalten',
    segmentNoNameFound: 'Kein Name gefunden',
    /** AGS view (8-digit input): VVVV row when reverse lookup did not find a matching ARS. */
    agsViewVvvvNotInAgs: 'Gemeindeverband nicht im AGS enthalten',
    /** AGS view (8-digit input): VVVV row caption when reverse lookup did find the full ARS. */
    agsViewVvvvFromLookup: '(aufgelöst aus Gemeindeverzeichnis)',
    /** Amber alert above the segments table when an 8-digit AGS could not be resolved. */
    agsNotResolvable: (ags8: string) =>
      `AGS ${ags8} ist nicht im Gemeindeverzeichnis enthalten. Der Gemeindeverband (VVVV) kann aus dem 8-stelligen Schlüssel allein nicht abgeleitet werden.`,
    /** keyOverviewRows ARS row suffix when input is an 8-digit AGS and reverse lookup failed. */
    arsNotDerivableFromAgs: '(aus 8-stelligem AGS nicht ableitbar)',
    /** Layout explainer block under the keyOverview table (Part C). */
    explainerLayoutTitle: 'Aufbau von AGS und ARS',
    explainerLayoutSlotsAgs: 'AGS = LL R KK GGG',
    explainerLayoutSlotsArs: 'ARS = LL R KK VVVV GGG',
    explainerWikiAgsLinkLabel: 'OSM-Wiki: de:amtlicher_gemeindeschluessel',
    explainerWikiArsLinkLabel: 'OSM-Wiki: de:regionalschluessel',
    explainerPaddingArtifactPara1:
      'Der ARS enthält zusätzlich zum AGS einen 4-stelligen Gemeindeverband (VVVV).',
    explainerPaddingArtifactPara2:
      'Das Padding gilt nur für die Normalisierung regional-12: 8 Ziffern werden dort rechts auf 12 Stellen mit Nullen ergänzt. Dadurch wirken die letzten 3 AGS-Ziffern im ARS-Schema so, als lägen sie im VVVV-Bereich. In der Segmente-Tabelle hier wird stattdessen der AGS direkt verwendet bzw. (falls verfügbar) über das Gemeindeverzeichnis zum vollständigen ARS aufgelöst.',
    agsTitle: 'Amtlicher Gemeindeschlüssel (8 Stellen, AGS)',
    agsLead:
      'Aus einer vollständigen 12-stelligen ARS ergibt sich der AGS aus LLRKK + GGG (also ohne die 4 Stellen des Gemeindeverbands).',
    agsFromArs: 'Aus 12-stelligem Schlüssel',
    berlinTitle: 'Berlin Bezirk',
    berlinLead:
      'Kurzform mit fünf Ziffern (z. B. 11001) wird im Vergleich auf acht Stellen expandiert.',
    berlinExpanded: 'Expandiert (berlin-bezirk-rs5)',
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
      'berlin-5-digit→8-digit-rs':
        'Berlin: 5-stelliger Regionalschlüssel zur 8-stelligen Kanonform erweitert',
      'already-8-digit': 'Bereits 8-stellig (keine Änderung)',
      'regional-12-padded': 'Weniger als 12 Ziffern — rechts mit Nullen auf 12 Stellen ergänzt',
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
    linksRegionalHub: 'Attribute vergleichen',
    linksDetailPage: 'Detailseite Statistikportal',
    linksWikiKeyPrefix: 'OSM Wiki',
    presets: {
      'berlin-bezirk-rs5': 'Berlin Bezirk → RS-5 → 8-stellig',
      'amtlicher-8': 'Amtlicher 8-stellig',
      'regional-12': 'Regionalschlüssel 12-stellig',
    },
  },

  map: {
    legendAria: 'Kartenlegende',
    official: 'Amtliche Grenze',
    osm: 'OpenStreetMap-Grenze',
    diff: 'Abweichungsflächen',
    /** Shown next to the diff layer toggle when diff PMTiles exist (detail map). */
    diffFromZoom12Short: 'ab Zoomstufe 12',
    simplificationLikelyBelowZoom15:
      'Geometrien werden bis Zoom 15 wahrscheinlich vereinfacht dargestellt.',
    fullDetailFromZoom15: 'Geometrien sollten volle Details haben.',
    zoomInForFullDetail: 'Auf Zoom 15 wechseln',
  },

  relationResolver: {
    metaTitle: (relationId: string) => `Grenzabgleich für Relation ${relationId} öffnen`,
    metaTitleObject: (id: string) => `Grenzabgleich für Relation ${id} öffnen`,
    title: (relationId: string) => `Grenzabgleich für Relation ${relationId} öffnen`,
    titleObject: (id: string) => `Grenzabgleich für Relation ${id} öffnen`,
    requestedDataset: (dataset: string) => `Dataset-Filter: ${dataset}`,
    notFound: 'Für diese Relation wurde kein Ziel im aktuellen Grenzvergleich gefunden.',
    notFoundObject: 'Für dieses OSM-Objekt wurde kein Ziel im aktuellen Grenzvergleich gefunden.',
    listLead:
      'Mehrere oder keine passenden Ziele für den Dataset-Filter gefunden. Bitte Ziel auswählen:',
    datasetLabel: (dataset: string) => `Datensatz: ${dataset}`,
    mismatchedDatasetHint: 'Anderer Datensatz als im Filter angefragt.',
    openFeature: 'Detailansicht öffnen',
  },

  /** Copy shown by route-level `pendingComponent` while the loader fetches data. */
  routeLoading: {
    generic: 'Lade Daten…',
    /** Area page: "Lade Vergleichsdaten für <name> (ca. <count> Datensätze)…". `count` omitted if not in bundled index. */
    area: (displayName: string, count: number | null) =>
      count == null
        ? `Lade Vergleichsdaten für ${displayName}…`
        : `Lade Vergleichsdaten für ${displayName} (ca. ${formatDeInteger(count)} Datensätze)…`,
    areaSubtitle:
      'Auswertungsdaten enthalten alle verglichenen Grenzen mit Geometrie- und Kennzahlen-Snippets.',
    /** Feature detail page: short label = decoded canonicalMatchKey. */
    feature: (label: string) => `Lade Detaildaten für ${label}…`,
    compare: (officialKey: string, osmKey: string) => `Lade Vergleich ${officialKey} ↔ ${osmKey}…`,
    changelog: 'Lade Changelog…',
    status: 'Lade Verarbeitungsstatus…',
    germanKey: 'Lade Schlüssel-Explorer…',
    regionalHub: 'Lade Regionalhub…',
    regionalHubDetail: (ars: string) => `Lade Einwohnervergleich für ${ars}…`,
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

export function categoryLabelDe(cat: ReportRow['category'], kind?: SourceKind): string {
  switch (cat) {
    case 'matched':
      return 'Zugeordnet'
    case 'official_only':
      return sourceText(kind, 'onlyLabel')
    case 'unmatched_osm':
      return 'Nur OSM'
    default:
      return cat
  }
}
