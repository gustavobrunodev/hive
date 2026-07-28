/**
 * WCAG contrast math over CSS computed colors.
 *
 * Exists because the visual pass kept shipping unreadable text: two secondary
 * labels on the accent-tinted CTA measured 3.93:1 and 3.46:1 in light theme,
 * both under the 4.5:1 floor and invisible to every test (STATE.md,
 * 2026-07-27). Contrast is objective, so it belongs in a computational
 * control rather than in someone's eye.
 *
 * The parser deliberately handles the `color(srgb r g b)` form: any token
 * built with `color-mix()` comes back from `getComputedStyle()` that way, with
 * channels as **0–1 floats**, not 0–255. A naive `rgb()` parser reads those as
 * near-black and reports confident nonsense — it once claimed 1.1:1 in dark and
 * 13:1 in light for the same declaration. That regression is pinned in
 * `contrast.test.ts`.
 *
 * Alpha is ignored: `getComputedStyle` already resolves to the used value, and
 * a translucent foreground has to be composited against real pixels anyway —
 * for those, sample the screenshot instead of trusting a declaration.
 */

/** The WCAG 2.x AA floor for body-sized text. */
export const WCAG_AA_NORMAL = 4.5
/** The WCAG 2.x AA floor for large text (>=18.66px bold, or >=24px). */
export const WCAG_AA_LARGE = 3

export interface Rgb {
  r: number
  g: number
  b: number
}

/**
 * Parses the color forms `getComputedStyle()` actually returns — `rgb()`,
 * `rgba()`, `color(srgb ...)` — into 0–255 channels. Returns `undefined` for
 * anything else (named colors, `transparent`, gradients) so callers can tell
 * "couldn't measure" from "measured badly".
 */
export function parseCssColor(value: string): Rgb | undefined {
  const text = value.trim().toLowerCase()

  const srgb = text.match(
    /^color\(\s*srgb\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s*(?:\/.*)?\)$/
  )
  if (srgb) {
    const channels = [srgb[1], srgb[2], srgb[3]].map(Number)
    if (channels.some((channel) => !Number.isFinite(channel))) return undefined
    const [r, g, b] = channels.map((channel) => Math.round(clamp01(channel) * 255))
    return { r, g, b }
  }

  const rgb = text.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(?:[,/].*)?\)$/)
  if (rgb) {
    const channels = [rgb[1], rgb[2], rgb[3]].map(Number)
    if (channels.some((channel) => !Number.isFinite(channel))) return undefined
    const [r, g, b] = channels.map((channel) => Math.round(Math.min(255, Math.max(0, channel))))
    return { r, g, b }
  }

  const hex = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/)
  if (hex) {
    const digits =
      hex[1].length === 3
        ? hex[1]
            .split('')
            .map((d) => d + d)
            .join('')
        : hex[1]
    return {
      r: parseInt(digits.slice(0, 2), 16),
      g: parseInt(digits.slice(2, 4), 16),
      b: parseInt(digits.slice(4, 6), 16)
    }
  }

  return undefined
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

/** WCAG relative luminance. */
export function relativeLuminance({ r, g, b }: Rgb): number {
  const [rl, gl, bl] = [r, g, b].map((channel) => {
    const c = channel / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl
}

/** Contrast ratio between two colors, 1–21. Order-independent. */
export function contrastRatio(foreground: Rgb, background: Rgb): number {
  const a = relativeLuminance(foreground)
  const b = relativeLuminance(background)
  const [lighter, darker] = a >= b ? [a, b] : [b, a]
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Convenience for the visual pass: takes the two CSS strings straight off
 * `getComputedStyle()` and reports pass/fail against a floor. `ratio` is
 * `undefined` when either color couldn't be parsed — treat that as
 * "unmeasured", not "passing".
 */
export function checkContrast(
  foregroundCss: string,
  backgroundCss: string,
  floor: number = WCAG_AA_NORMAL
): { ratio?: number; passes: boolean } {
  const foreground = parseCssColor(foregroundCss)
  const background = parseCssColor(backgroundCss)
  if (!foreground || !background) return { passes: false }
  const ratio = contrastRatio(foreground, background)
  return { ratio, passes: ratio >= floor }
}
