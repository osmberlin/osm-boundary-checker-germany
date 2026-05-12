import type { MetricInfoCopy } from '../metricInfoCopy.ts'

export const iouModalDe: MetricInfoCopy = {
  triggerAria: 'Erklärung zu IoU anzeigen',
  title: 'Was ist Intersection over Union (IoU)?',
  lead: 'IoU fasst in einer Zahl zusammen, wie ähnlich sich die Flächen aus amtlicher und OSM-Grenze sind. Höhere Werte stehen für mehr Deckung.',
  howToRead: [],
  technical: [
    'Der IoU-Quotient entsteht aus der gemeinsamen Fläche geteilt durch die Vereinigung aus amtlichem und OSM-Polygon — dieselbe Größe taucht in der Mengenlehre oft als Jaccard-Koeffizient und in der Bildverarbeitung meist unter dem Namen IoU auf.',
    'Niedrigere Werte entstehen typischerweise, wenn mehr Fläche nur einer Quelle zugeordnet ist.',
  ],
  references: [
    {
      label: 'Wikipedia: Jaccard-Index',
      href: 'https://en.wikipedia.org/wiki/Jaccard_index',
      note: 'Für Flächen als Mengen ist das rechnerisch dasselbe wie IoU.',
    },
  ],
  close: 'Schließen',
  appendMetricsCrsNote: true,
  metricsCrsNoteStyle: 'appendSentence',
  hideTechnicalHeading: true,
}
