import type { MetricInfoCopy } from '../metricInfoCopy.ts'

/** Strings for the area report IoU chart (no info modal yet — copy is ready if added). */
export const meanIouChartDe = {
  chartTitle: 'Mittlere IoU über Snapshots',
  chartTooltipIou: 'IoU',
} as const

export const meanIouModalDe: MetricInfoCopy = {
  triggerAria: 'Erklärung zur mittleren IoU anzeigen',
  title: 'Was ist die mittlere IoU?',
  lead: 'Über alle Tabellenzeilen mit gültiger IoU wird der einfache Mittelwert gebildet — jede Einheit zählt gleich stark.',
  howToRead: [
    'Die Kennzahl fasst die Gesamtlage des Gebiets in einer Zahl zusammen; sie ersetzt nicht die Einzelzeilen. Ausreißer in einzelnen Gemeinden können den Mittelwert merklich drücken oder heben.',
    'Nur Zeilen mit zugeordnetem amtlichen und OSM-Polygon und gültigen Metriken fließen ein. „Nur amtlich“ ohne OSM liefert keine IoU und geht nicht in den Mittelwert ein.',
  ],
  technical: [
    'In Snapshots wird dieselbe Kennzahl pro Lauf als meanIou in snapshots.json gespeichert und im Diagramm über die Zeit dargestellt.',
  ],
  close: 'Schließen',
  appendMetricsCrsNote: true,
  metricsCrsNoteStyle: 'appendSentence',
}
