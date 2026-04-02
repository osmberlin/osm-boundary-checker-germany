import type { MetricInfoCopy } from '../metricInfoCopy.ts'

export const symDiffModalDe: MetricInfoCopy = {
  triggerAria: 'Erklärung zur symmetrischen Differenz anzeigen',
  title: 'Was ist die symmetrische Differenz?',
  lead: 'Die Kennzahl ist der Anteil der symmetrischen Differenzfläche an der amtlichen Referenzfläche — also wie viel Fläche nur einer der beiden Quellen zugeordnet ist, bezogen auf die amtliche Fläche.',
  paragraphs: [
    'Geometrisch ist die symmetrische Differenz zweier Polygone die Fläche, die in genau einer der beiden Flächen liegt (ohne den gemeinsamen Schnitt). Rechnerisch: amtliche Fläche plus OSM-Fläche minus zweimal die Schnittfläche. Der angezeigte Prozentwert ist diese symmetrische Differenzfläche geteilt durch die amtliche Fläche, mal 100.',
    'Unterschied zu „Flächenabweichung“ (Δ Fläche %): Dort geht es nur um den Betrag der Differenz der beiden Gesamtflächen. Die symmetrische Differenz misst dagegen die kombinierte „nur amtlich“- und „nur OSM“-Fläche — sie hängt eng mit den in der Karte dargestellten Abweichungsflächen zusammen.',
    'Gemeinsam mit IoU und Hausdorff hilft der Wert, Fälle einzuordnen, in denen die Grenzen zwar ähnlich verlaufen, aber Flächen seitlich verschoben oder unterschiedlich gefüllt sind.',
  ],
  close: 'Schließen',
}
