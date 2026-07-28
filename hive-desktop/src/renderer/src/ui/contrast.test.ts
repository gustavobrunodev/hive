import { describe, expect, it } from 'vitest'
import {
  WCAG_AA_LARGE,
  WCAG_AA_NORMAL,
  checkContrast,
  contrastRatio,
  parseCssColor,
  relativeLuminance
} from './contrast'

describe('parseCssColor', () => {
  it('parses rgb() and rgba() in 0-255 channels', () => {
    expect(parseCssColor('rgb(36, 33, 33)')).toEqual({ r: 36, g: 33, b: 33 })
    expect(parseCssColor('rgba(255, 255, 255, 0.5)')).toEqual({ r: 255, g: 255, b: 255 })
    expect(parseCssColor('rgb(8 8 8 / 90%)')).toEqual({ r: 8, g: 8, b: 8 })
  })

  it('parses the color(srgb ...) form as 0-1 floats, not 0-255', () => {
    // The regression that produced 1.1:1 in dark and 13:1 in light for the
    // *same* declaration (STATE.md, 2026-07-27): read as 0-255 these channels
    // are near-black; they are in fact a light warm grey.
    expect(parseCssColor('color(srgb 0.75 0.71 0.71)')).toEqual({ r: 191, g: 181, b: 181 })
    expect(parseCssColor('color(srgb 1 1 1)')).toEqual({ r: 255, g: 255, b: 255 })
    expect(parseCssColor('color(srgb 0 0 0 / 0.8)')).toEqual({ r: 0, g: 0, b: 0 })
  })

  it('parses hex shorthand and longhand', () => {
    expect(parseCssColor('#242121')).toEqual({ r: 36, g: 33, b: 33 })
    expect(parseCssColor('#fff')).toEqual({ r: 255, g: 255, b: 255 })
  })

  it('returns undefined for forms it cannot measure rather than guessing', () => {
    expect(parseCssColor('transparent')).toBeUndefined()
    expect(parseCssColor('currentColor')).toBeUndefined()
    expect(parseCssColor('linear-gradient(red, blue)')).toBeUndefined()
    expect(parseCssColor('color(display-p3 0.5 0.5 0.5)')).toBeUndefined()
  })
})

describe('contrastRatio', () => {
  it('spans the full 1-21 range at the extremes', () => {
    expect(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(21, 5)
    expect(contrastRatio({ r: 120, g: 120, b: 120 }, { r: 120, g: 120, b: 120 })).toBeCloseTo(1, 5)
  })

  it('is order-independent', () => {
    const light = { r: 240, g: 240, b: 240 }
    const dark = { r: 20, g: 20, b: 20 }
    expect(contrastRatio(light, dark)).toBeCloseTo(contrastRatio(dark, light), 10)
  })

  it('computes relative luminance per WCAG (white = 1, black = 0)', () => {
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 5)
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0, 5)
  })
})

describe('checkContrast', () => {
  it('fails a pair below the AA normal floor', () => {
    // #767676 on white is ~4.54:1; nudging it lighter drops it under.
    const result = checkContrast('#8a8a8a', '#ffffff')
    expect(result.ratio).toBeLessThan(WCAG_AA_NORMAL)
    expect(result.passes).toBe(false)
  })

  it('passes a pair at or above the floor', () => {
    const result = checkContrast('rgb(0, 0, 0)', 'color(srgb 1 1 1)')
    expect(result.ratio).toBeCloseTo(21, 5)
    expect(result.passes).toBe(true)
  })

  it('honours the large-text floor', () => {
    const foreground = '#949494'
    expect(checkContrast(foreground, '#ffffff', WCAG_AA_NORMAL).passes).toBe(false)
    expect(checkContrast(foreground, '#ffffff', WCAG_AA_LARGE).passes).toBe(true)
  })

  it('reports an unparseable color as not passing, with no ratio', () => {
    expect(checkContrast('transparent', '#ffffff')).toEqual({ passes: false })
  })
})
