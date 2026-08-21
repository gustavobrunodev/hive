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
  /** The theme's page background — the preview's field. */
  bg: string
  /** Its raised surface — the rail the preview draws down the left. */
  surface: string
  /** Its body ink — the type the preview stands in for. */
  ink: string
  /** Its accent, the one saturated colour on that background. */
  accent: string
}

/**
 * Literal previews, kept in sync by hand with `assets/theme.css` — and by the
 * unit tests that assert each set still clears the contrast floors, so a
 * drifted copy shows up as a failure rather than as a muddy tile in a menu.
 *
 * Four values rather than two, because the picker draws a **miniature of the
 * workbench** — rail, document, accent — instead of a coloured dot. A dot can
 * only answer "what hue is this theme"; nobody picks a theme by hue. What they
 * want to know is how light the surface is, how much the panel separates from
 * the page, and where the one saturated colour lands — which is exactly what
 * the four values below draw.
 */
export const THEME_SWATCHES: Record<Theme, ThemeSwatch> = {
  dark: { bg: '#1c1a1a', surface: '#2b2828', ink: '#ded4d4', accent: '#cc7958' },
  light: { bg: '#f5f0f0', surface: '#ffffff', ink: '#260a12', accent: '#852838' },
  hive: { bg: '#260a12', surface: '#3a1620', ink: '#ded4d4', accent: '#cc7958' }
}
