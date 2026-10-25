import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { categoryLabelDe } from './de'
import { renderWithAbbr, SourceTerm, sourceText } from './sourceVocabulary'

describe('sourceVocabulary', () => {
  it('keeps "amtlich" wording for the official kind and absent kind', () => {
    expect(sourceText('official', 'onlyLabel')).toBe('Nur amtlich')
    expect(sourceText(undefined, 'dataHeading')).toBe('Amtliche Daten')
    expect(categoryLabelDe('official_only')).toBe('Nur amtlich')
  })

  it('uses compound DtP nouns without declension for the dtp kind', () => {
    expect(sourceText('dtp', 'onlyLabel')).toBe('Nur DtP')
    expect(sourceText('dtp', 'areaLabel')).toBe('DtP-Fläche')
    expect(sourceText('dtp', 'openIdWithGeojson')).toBe('In iD öffnen mit DtP-Grenze (GeoJSON)')
    expect(categoryLabelDe('official_only', 'dtp')).toBe('Nur DtP')
  })

  it('renders every standalone DtP as abbr with the full name', () => {
    const html = renderToStaticMarkup(
      createElement(SourceTerm, { kind: 'dtp', term: 'dataHeading' }),
    )
    expect(html).toContain('<abbr title="Digitize the Planet e.V."')
    expect(html).toContain('>DtP</abbr>-Daten')
    expect(
      renderToStaticMarkup(createElement(SourceTerm, { kind: 'official', term: 'dataHeading' })),
    ).toBe('Amtliche Daten')
    expect(renderWithAbbr('keine Abkürzung')).toBe('keine Abkürzung')
  })
})
