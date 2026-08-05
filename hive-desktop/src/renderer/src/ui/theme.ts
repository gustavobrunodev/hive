/**
 * The app's theme vocabulary, in one place.
 *
 * Three themes, not two, so "dark or light" is no longer a boolean anywhere:
 * `dark` is the neutral graphite workbench (the default — hours of reading
 * shouldn't happen inside an ambient hue), `light` is the daylight register,
 * and `hive` is the brand's own bordo ledger for people who want to work
 * inside the identity. The colour values themselves live in
 * `assets/theme.css`; what lives here is the set, the persistence, and the
 * swatches the picker paints — which are deliberately literal hex values and
 * not role tokens, because a preview of a theme you are *not* currently in
 * cannot be drawn with the tokens of the theme you *are* in.
 */

export type Theme = 'dark' | 'light' | 'hive'

export const DEFAULT_THEME: Theme = 'dark'

/** Menu order: the two neutral registers first, then the brand one. */
export const THEMES: readonly Theme[] = ['dark', 'light', 'hive']

export const THEME_STORAGE_KEY = 'hive-desktop-theme'

export function isTheme(value: unknown): value is Theme {
  return value === 'dark' || value === 'light' || value === 'hive'
}

/** The persisted choice, or the default — including for a value written by an older build. */
export function readStoredTheme(): Theme {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
  return isTheme(stored) ? stored : DEFAULT_THEME
}

export interface ThemeSwatch {
  /** The theme's page background. */
  bg: string
  /** Its accent, the one saturated colour on that background. */
  accent: string
}

/**
 * Literal previews, kept in sync by hand with `assets/theme.css` — and by the
 * unit test that asserts each swatch pair still clears 3:1, so a drifted copy
 * shows up as a failure rather than as a muddy dot in a menu.
 */
export const THEME_SWATCHES: Record<Theme, ThemeSwatch> = {
  dark: { bg: '#1c1a1a', accent: '#cc7958' },
  light: { bg: '#f5f0f0', accent: '#852838' },
  hive: { bg: '#260a12', accent: '#cc7958' }
}
