// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_THEME,
  THEMES,
  THEME_STORAGE_KEY,
  THEME_SWATCHES,
  isTheme,
  readStoredTheme
} from './theme'
import { WCAG_AA_LARGE, checkContrast } from './contrast'

describe('theme vocabulary', () => {
  afterEach(() => {
    window.localStorage.clear()
  })

  it('offers exactly the three themes `assets/theme.css` resolves, dark first', () => {
    expect([...THEMES]).toEqual(['dark', 'light', 'hive'])
    expect(DEFAULT_THEME).toBe('dark')
  })

  it('accepts only the three known ids', () => {
    for (const theme of THEMES) expect(isTheme(theme)).toBe(true)
    for (const other of ['', 'HIVE', 'bordo', null, undefined, 42]) {
      expect(isTheme(other)).toBe(false)
    }
  })

  it('reads back a persisted choice', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'hive')

    expect(readStoredTheme()).toBe('hive')
  })

  it('falls back to the default for a missing or unrecognized stored value', () => {
    expect(readStoredTheme()).toBe(DEFAULT_THEME)

    // A build older than the third theme could have written anything here, and
    // an unknown `data-theme` on the root resolves to no theme at all — so the
    // guard has to reject rather than pass the string through.
    window.localStorage.setItem(THEME_STORAGE_KEY, 'solarized')
    expect(readStoredTheme()).toBe(DEFAULT_THEME)
  })

  it('gives every theme a swatch whose accent is legible on its own background', () => {
    // The picker's swatches are hand-copied hex from `assets/theme.css` —
    // nothing makes them follow a token edit. This is the tripwire: if a theme
    // is re-tuned and its swatch isn't, the pair stops clearing the 3:1
    // non-text floor and the menu starts showing a muddy dot.
    for (const theme of THEMES) {
      const { bg, accent } = THEME_SWATCHES[theme]
      const { ratio } = checkContrast(accent, bg)

      expect(ratio, `${theme} swatch accent on its own background`).toBeGreaterThanOrEqual(
        WCAG_AA_LARGE
      )
    }
  })
})
