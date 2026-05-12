import type { MetricInfoCopy } from '../metricInfoCopy.ts'

export const symDiffModalDe: MetricInfoCopy = {
  triggerAria: 'Erklärung zur symmetrischen Differenz anzeigen',
  title: 'Was ist die symmetrische Differenz?',
  lead: 'Die symmetrische Differenz fasst in einer Zahl zusammen, welcher Anteil der Fläche nur einer Quelle zugeordnet ist — nur amtlich oder nur OSM — und damit nicht zur gemeinsamen Überlappung gehört.',
  howToRead: [],
  technical: [
    'Rechnerisch entspricht das der symmetrischen Differenz als Fläche: amtliche Fläche plus OSM-Fläche minus das Doppelte der Schnittfläche — dieselbe Mengenidee wie die symmetrische Differenz zweier Flächen in der Mathematik. Dieser Flächenwert wird auf die amtliche Fläche bezogen und mit 100 multipliziert, sodass ein Prozentwert entsteht.',
    'Niedrigere Werte entstehen typischerweise, wenn sich die Grenzen weitgehend decken und wenig Fläche ausschließlich einer Quelle verbleibt; höhere Werte, wenn mehr Fläche nur einer der beiden Zuordnungen zugeordnet ist.',
  ],
  references: [
    {
      label: 'Wikipedia: Symmetrische Differenz',
      href: 'https://de.wikipedia.org/wiki/Symmetrische_Differenz',
    },
  ],
  close: 'Schließen',
  appendMetricsCrsNote: true,
  metricsCrsNoteStyle: 'appendSentence',
  hideTechnicalHeading: true,
}
