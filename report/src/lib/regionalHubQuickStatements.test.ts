import { describe, expect, test } from 'vitest'
import {
  destatisPopulationQuickStatement,
  destatisPopulationQuickStatementsUrl,
  osmRelationP402QuickStatement,
} from './regionalHubQuickStatements'

describe('regionalHubQuickStatements', () => {
  test('builds Destatis P1082 v1 with retrieved date and Destatis as source', () => {
    const command = destatisPopulationQuickStatement({
      qid: 'Q3931',
      population: 74113,
      pointInTimeIso: '2024-12-31',
      sourceUrl: 'https://www.destatis.de/example',
      retrievedIso: '2026-09-04',
    })
    expect(command).toBe(
      'Q3931|P1082|74113|P585|+2024-12-31T00:00:00Z/11|S248|Q764739|S854|"https://www.destatis.de/example"|S813|+2026-09-04T00:00:00Z/11',
    )
    expect(
      destatisPopulationQuickStatementsUrl({
        qid: 'Q3931',
        population: 74113,
        pointInTimeIso: '2024-12-31',
        sourceUrl: 'https://www.destatis.de/example',
        retrievedIso: '2026-09-04',
      }),
    ).toContain('quickstatements.toolforge.org/#/v1=')
  })

  test('builds P402 as quoted OSM relation id', () => {
    expect(osmRelationP402QuickStatement('Q3931', 'relation/62470')).toBe('Q3931|P402|"62470"')
  })
})
