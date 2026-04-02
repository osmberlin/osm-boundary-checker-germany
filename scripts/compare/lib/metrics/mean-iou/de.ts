import type { MetricInfoCopy } from '../metricInfoCopy.ts'

/** Strings for the area report IoU chart (no info modal yet — copy is ready if added). */
export const meanIouChartDe = {
  chartTitle: 'Mittlere IoU über Snapshots',
  chartTooltipIou: 'IoU',
} as const

export const meanIouModalDe: MetricInfoCopy = {
  triggerAria: 'Erklärung zur mittleren IoU anzeigen',
  title: 'Was ist die mittlere IoU?',
  lead: 'Über alle Zeilen der Tabelle, für die eine IoU berechnet wurde, wird der einfache Mittelwert gebildet — jede Einheit zählt gleich stark.',
  paragraphs: [
    'Nur Zeilen mit zugeordnetem amtlichen und OSM-Polygon und gültigen Metriken fließen ein. Zeilen „nur amtlich“ ohne OSM-Geometrie haben keine IoU und werden nicht gemittelt.',
    'Die Kennzahl fasst die Gesamtlage des Gebiets in einer Zahl zusammen; sie ersetzt nicht die Einzelzeilen. Starke Ausreißer in einzelnen Gemeinden oder Bezirken können den Mittelwert merklich beeinflussen.',
    'In Snapshots wird dieselbe Regel pro Lauf in snapshots.json als meanIou gespeichert und im Diagramm über die Zeit dargestellt.',
  ],
  close: 'Schließen',
}
