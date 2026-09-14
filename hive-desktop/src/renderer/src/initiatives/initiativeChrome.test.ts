// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { INITIATIVE_COLORS } from './initiatives'
import { RELEASES, YEAR_SPAN, colorSwatches, colorVar, initiativeMarks } from './initiativeChrome'

/**
 * The appearance vocabulary every surface that shows a demand resolves
 * through. One definition, because the badge in the conversation list and the
 * swatch in the edit dialog are the same colour making the same promise.
 */
describe('initiativeChrome', () => {
  it('resolves a hue through the theme, never as a frozen value', () => {
    // A name, not a hex: the badge shows up on three themes, and a colour
    // picked against the dark one is the colour that fails on the light one.
    expect(colorVar('violet')).toBe('var(--init-violet)')
  })

  it('offers the whole palette, each swatch named for a screen reader', () => {
    const swatches = colorSwatches()
    expect(swatches.map((swatch) => swatch.id)).toEqual([...INITIATIVE_COLORS])
    expect(swatches.every((swatch) => swatch.label.trim() !== '')).toBe(true)
    expect(swatches[0].color).toBe(colorVar(INITIATIVE_COLORS[0]))
  })

  it('keys demands by folder path, which is what a conversation stores', () => {
    const marks = initiativeMarks([
      { path: 'docs/iniciativas/R1/testes', title: 'Testes', color: 'sky' },
      { path: 'docs/iniciativas/R2/portal', title: 'Portal', color: 'rose' }
    ])
    expect(marks['docs/iniciativas/R1/testes']).toEqual({ title: 'Testes', color: 'sky' })
    expect(marks['docs/iniciativas/R2/portal']?.color).toBe('rose')
    expect(marks['docs/iniciativas/R9/nada']).toBeUndefined()
  })

  it('answers with an empty lookup for a workspace with no demands', () => {
    expect(initiativeMarks([])).toEqual({})
  })

  it('keeps the release set closed, so a typo cannot invent a folder', () => {
    expect([...RELEASES]).toEqual(['R1', 'R2', 'R3', 'R4'])
    expect(YEAR_SPAN).toBeGreaterThan(0)
  })
})
