import { AREAS_GEN_BASENAME } from '../../generatedAssets.ts'
import type { ReportRow } from '../types/report'

/** UI copy (German) */
export const de = {
  appTitle: 'OSM-Grenzabgleich (Deutschland)',

  hausdorffInfo: {
    triggerAria: 'Erklärung zum Hausdorff-Abstand anzeigen',
    title: 'Was ist der Hausdorff-Abstand?',
    lead: 'Kurz gesagt: ein Maß dafür, wie weit die beiden Grenzlinien maximal auseinanderliegen — in Metern, im projizierten Koordinatensystem des Vergleichs.',
    paragraphs: [
      'Der Hausdorff-Abstand vergleicht die amtliche Grenze mit der OSM-Grenze. Er sucht die größte „Lücke“ zwischen den beiden Umrissen: An welcher Stelle muss man am weitesten von einem Rand zum anderen gehen? Dieser maximale Abstand (in beide Richtungen betrachtet) ist der angezeigte Wert.',
      'Kleine Werte bedeuten: Die Linien liegen überall nah beieinander. Größere Werte deuten auf eine Stelle hin, an der eine der beiden Quellen stärker abweicht — zum Beispiel durch Vereinfachung der Geometrie, unterschiedliche Toleranzen oder lokale Kartierungsunterschiede.',
      'Andere Spalten wie IoU oder Flächenabweichung beschreiben vor allem die Überlappung der Flächen. Der Hausdorff-Abstand ergänzt das: Er betont den schlechtesten Punkt entlang der Grenze, nicht nur den Durchschnitt.',
      'Technisch wird hier ein diskreter Hausdorff-Abstand (JSTS) auf den projizierten Polygonen berechnet — das entspricht der üblichen Praxis und ist für diesen Bericht ausreichend fein.',
    ],
    close: 'Schließen',
  },

  iouInfo: {
    triggerAria: 'Erklärung zu IoU anzeigen',
    title: 'Was ist IoU (Intersection over Union)?',
    lead: 'IoU ist ein Maß dafür, wie stark sich die beiden Flächen — amtliche Grenze und OSM — überlappen. Der Wert liegt zwischen 0 und 1; höhere Werte bedeuten mehr Übereinstimmung der Flächen.',
    paragraphs: [
      'Technisch ist IoU der Quotient aus Schnittfläche und Vereinigungsfläche der beiden Polygone (Jaccard-Index für die Flächen). Steht viel Fläche in beiden Polygonen gemeinsam im Verhältnis zur gesamten von beiden bedeckten Fläche, liegt IoU nahe 1. Bei 1 wären die Flächen identisch (kein nur-amtlicher und kein nur-OSM-Bereich innerhalb der Vereinigung).',
      'Niedrigere Werte bedeuten: Es gibt mehr Fläche, die nur bei einer der Quellen vorkommt — etwa durch versetzte Grenzen, fehlende oder zusätzliche Geometrie.',
      'In diesem Projekt werden die Polygone im projizierten Metrik-Koordinatensystem des Vergleichs ausgewertet. IoU fasst die Übereinstimmung in einer Kennzahl zusammen; sie sagt wenig darüber aus, wo entlang der Linie die größte Abweichung liegt — dafür ist der Hausdorff-Abstand gedacht.',
    ],
    close: 'Schließen',
  },

  areaDeltaInfo: {
    triggerAria: 'Erklärung zu Δ Fläche % anzeigen',
    title: 'Was bedeutet „Δ Fläche %“?',
    lead: 'Die Spalte zeigt, wie stark sich die eingeschlossene Fläche von OSM von der amtlichen Referenzfläche unterscheidet — als Prozent der amtlichen Fläche.',
    paragraphs: [
      'Berechnung: Betrag der Differenz aus OSM-Fläche minus amtlicher Fläche, geteilt durch die amtliche Fläche, mal 100. Angezeigt wird der absolute Wert (ohne Vorzeichen): Es geht nur um die Größe der Abweichung, nicht darum, ob OSM größer oder kleiner ist.',
      'Eine kleine Prozentzahl heißt: Die Gesamtflächen sind annähernd gleich groß. Eine große Zahl kann auch dann auftreten, wenn die Grenzlinien lokal noch nah beieinander liegen — etwa bei unterschiedlicher Generalisierung oder wenn eine Quelle das Gebiet anders „füllt“.',
      'Gemeinsam mit IoU hilft diese Kennzahl, Fälle zu erkennen, in denen die Flächenbilanz stark von der Referenz abweicht. Sie ergänzt IoU und Hausdorff: IoU betont Überlappung, Hausdorff den schlimmsten Punkt entlang der Linie, Δ Fläche % die reine Größenabweichung der Flächen.',
    ],
    close: 'Schließen',
  },

  symDiffInfo: {
    triggerAria: 'Erklärung zur symmetrischen Differenz anzeigen',
    title: 'Was ist die symmetrische Differenz?',
    lead: 'Die Kennzahl ist der Anteil der symmetrischen Differenzfläche an der amtlichen Referenzfläche — also wie viel Fläche nur einer der beiden Quellen zugeordnet ist, bezogen auf die amtliche Fläche.',
    paragraphs: [
      'Geometrisch ist die symmetrische Differenz zweier Polygone die Fläche, die in genau einer der beiden Flächen liegt (ohne den gemeinsamen Schnitt). Rechnerisch: amtliche Fläche plus OSM-Fläche minus zweimal die Schnittfläche. Der angezeigte Prozentwert ist diese symmetrische Differenzfläche geteilt durch die amtliche Fläche, mal 100.',
      'Unterschied zu „Flächenabweichung“ (Δ Fläche %): Dort geht es nur um den Betrag der Differenz der beiden Gesamtflächen. Die symmetrische Differenz misst dagegen die kombinierte „nur amtlich“- und „nur OSM“-Fläche — sie hängt eng mit den in der Karte dargestellten Abweichungsflächen zusammen.',
      'Gemeinsam mit IoU und Hausdorff hilft der Wert, Fälle einzuordnen, in denen die Grenzen zwar ähnlich verlaufen, aber Flächen seitlich verschoben oder unterschiedlich gefüllt sind.',
    ],
    close: 'Schließen',
  },

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
      { name: 'MapLibre GL', href: 'https://maplibre.org/' },
      { name: 'PMTiles', href: 'https://github.com/protomaps/PMTiles' },
      { name: 'Recharts', href: 'https://recharts.org/' },
    ],
  },

  /** In-page block: data freshness, source URLs, OSM pipeline (not the global AppFooter). */
  provenance: {
    sectionAria: 'Datenstand, Quellen und Filterung',
    title: 'Datenstand und Quellen',
    reportCreatedLabel: 'Auswertung erstellt',
    officialDownloadLabel: 'Amtliche Geometrien (Download/Stand)',
    osmDownloadLabel: 'OSM-Geometrien (Download/Stand)',
    officialHeading: 'Amtliche Daten',
    officialLead:
      'Die Vergleichsgeometrie auf der amtlichen Seite stammt aus den je nach Gebiet konfigurierten Quellen — z. B. BKG VG25 (Skript bkg:extract) oder ein Landes-WFS. Steht eine URL in den Metadaten, ist sie unten verlinkt.',
    officialMetaPrefix: 'Hinterlegt',
    sourceLinkLabel: 'Quelle (extern)',
    licenseLabel: 'Lizenz',
    osmHeading: 'OpenStreetMap',
    osmLead:
      'Die OSM-Geometrien werden aus einem Geofabrik-Länder-Extract gewonnen (üblicherweise Germany), lokal zwischengespeichert und anschließend gefiltert.',
    osmFilterTitle: 'Filterung (OSM)',
    osmFilterBody:
      'Zuerst schränkt osmium tags-filter die PBF typischerweise auf administrative Grenz-Relationen und -Ways ein (Standard z. B. r/boundary=administrative und w/boundary=administrative). Danach wählt ogr2ogr auf dem GDAL-Layer multipolygons mit einer gebietsspezifischen Bedingung (ogrWhere oder -sql in config.jsonc) die Zielobjekte aus.',
    osmFilterNoteTitle: 'Konkrete Zusammenfassung aus dem Build',
    unmatchedCrossLinkIntro:
      'Zusätzliche OSM-Grenzen ohne Entsprechung im amtlichen Export dieses Gebiets:',
  },

  home: {
    processingStatusLink: 'Verarbeitungsstatus öffnen',
    leadBefore: 'Gebiet wählen. Die Auswertung wird aus dem Ordner',
    leadAfter: 'des jeweiligen Gebiets gelesen (zuerst den Vergleich ausführen).',
    loadingAreas: 'Gebiete werden geladen …',
    noAreas:
      'Keine Gebiete mit output/comparison_table.json unter datasets/ gefunden. Vergleich ausführen (bun run compare).',
    areasError: `Gebiete konnten nicht geladen werden (${AREAS_GEN_BASENAME} fehlt oder ist ungültig).`,
    /** Home list: per-area row of category counts. */
    categoryStatsAria: 'Zugeordnet, nur amtlich, OSM ohne BKG-Treffer — Anzahl',
    unmatchedStat: 'OSM ohne BKG-Treffer',
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
    snapshot: 'Snapshot',
    snapshotLatest: 'Aktuell (output/)',
    chartTitle: 'Mittlere IoU über Snapshots',
    /** Freshness block heading (line 1). */
    freshnessHeadingReport: 'Auswertung',
    freshnessHeadingOfficial: 'Amtliche Daten',
    freshnessHeadingOsm: 'OSM Daten',
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
    chartTooltipIou: 'IoU',
    unmatchedPageLink: 'OSM ohne Treffer in diesem amtlichen Layer →',
    unmatchedCountLabel: 'OSM ohne BKG-Treffer (gesamt)',
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
      /** Below map: CRS line, middle dot, Hausdorff/JSTS doc link. */
      footnote: {
        /** Shown below the feature map when metrics exist. */
        metricsCrsLine: (crs: string) => `Projiziertes Metrik-Koordinatensystem: ${crs}`,
        hausdorffDoc: {
          label: 'Hausdorff diskret (JSTS)',
          href: 'https://locationtech.github.io/jts/javadoc/org/locationtech/jts/algorithm/distance/DiscreteHausdorffDistance.html',
          title:
            'Java Topology Suite (JTS): DiscreteHausdorffDistance — JSTS übernimmt diese Algorithmik in JavaScript.',
        },
      },
    },
    noMetrics: 'Keine Überlappungsmetriken (auf einer Seite fehlt die Geometrie).',
    noPmtiles:
      'Kein Kachel-Archiv (comparison.pmtiles) vorhanden — Vergleich mit Geometrien ausführen (tippecanoe erforderlich).',
    liveSourcesSectionAria: 'Live-Attribute von amtlichen Diensten und OSM',
    liveSourcesSectionTitle: 'Quellenattribute abfragen',
    liveSourcesSectionLead:
      'WFS: konfigurierte amtliche Dienste für den Kartenausschnitt (Bounding Box aus dem Vergleich, leicht gepuffert). OSM: optionale Overpass-Abfrage für alle `boundary=administrative`-Relationen und -Ways in genau diesem Kasten — ohne weitere Tag-Filter, zum manuellen Abgleich.',
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
    liveOsmLoad: 'Verwaltungsgrenzen im Ausschnitt laden …',
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
    liveOsmEmpty: 'Keine Treffer (`boundary=administrative` in diesem Kasten).',
    liveOsmHitNoTags: '(keine Tags)',
    liveOsmInvalidJson: 'Unerwartete Overpass-Antwort.',
    liveOsmHttp: 'Overpass-Anfrage fehlgeschlagen:',
    liveOsmHitTitle: (osmType: string, id: number) => `${osmType} ${id}`,

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
      snapshotNoEditorFiles:
        'Historische Tabellen-Snapshots enthalten keine mitgelieferten GeoJSON-Dateien; für die Bearbeitungs-Exports die aktuelle Auswertung (ohne Snapshot) oder den Vergleich erneut ausführen.',
      legacyTableHint:
        'Diese comparison_table.json enthält noch kein Feld officialForEditPath — bitte den Vergleich erneut ausführen, um die GeoJSON-Exports zu erzeugen.',
    },
  },

  unmatched: {
    /** Short label for the breadcrumb (full title stays on the page). */
    breadcrumbLabel: 'OSM ohne Treffer',
    title: 'OSM ohne Treffer im amtlichen Export',
    lead: 'Diese OSM-Grenzen haben ein „de:regionalschluessel“, das nach Normalisierung in keiner Zeile des amtlichen FlatGeobuf dieser Fläche vorkommt (falsche Hierarchie, veralteter Schlüssel, Tippfehler, …).',
    backToArea: '← Zur Gebietsauswertung',
    tableKey: 'Schlüssel',
    tableName: 'Name',
    tableAdminLevel: 'admin_level',
    tableRelation: 'Relation',
    mapOnlyLatest:
      'Karte nur für die aktuelle Auswertung (output/unmatched.pmtiles); historische Snapshots enthalten keine Kachel-Datei.',
    noData: 'Keine Einträge — alle extrahierten OSM-Schlüssel passen zum amtlichen Export.',
    noPmtiles: 'Keine Karte (unmatched.pmtiles fehlt oder leer).',
  },

  map: {
    legendAria: 'Kartenlegende',
    official: 'Amtliche Grenze',
    osm: 'OpenStreetMap-Grenze',
    diff: 'Abweichungsflächen',
  },
} as const

export function categoryLabelDe(cat: ReportRow['category']): string {
  switch (cat) {
    case 'matched':
      return 'Zugeordnet'
    case 'official_only':
      return 'Nur amtlich'
    default:
      return cat
  }
}
