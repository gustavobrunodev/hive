/**
 * Design Studio (M18) — the device the stage is pretending to be (DS-R3).
 *
 * The sizes are the real ones, not round numbers: the whole point of D-DS-7 is
 * that the Preview renders at the device's true width so the design system's
 * media queries answer the same way they will on the device. A "1000px tablet"
 * would make the Preview lie in exactly the way the scaling rule exists to
 * prevent.
 *
 * Viewport lives **outside** the document (AD "State & cross-cutting"): it is
 * not a `Command`, never enters the undo log, and never reaches the session
 * file. Switching preset therefore cannot cost the user an edit (DS-R3 AC-1).
 */

export type ViewportPresetId = 'mobile' | 'tablet' | 'desktop'

export interface ViewportSize {
  width: number
  height: number
}

export interface Viewport extends ViewportSize {
  /** `null` = a custom size the user typed. */
  presetId: ViewportPresetId | null
}

export const VIEWPORT_PRESETS: Readonly<Record<ViewportPresetId, ViewportSize>> = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 834, height: 1112 },
  desktop: { width: 1440, height: 900 }
}

/** The order the segmented control shows, smallest first. */
export const VIEWPORT_PRESET_ORDER: readonly ViewportPresetId[] = ['mobile', 'tablet', 'desktop']

export const DEFAULT_VIEWPORT: Viewport = { presetId: 'desktop', ...VIEWPORT_PRESETS.desktop }

/**
 * Bounds for a custom size. The floor is a width no design system has a
 * breakpoint below; the ceiling keeps a typo (`14400`) from producing a stage
 * scaled to 4% and a Preview nobody can read.
 */
export const MIN_VIEWPORT = 240
export const MAX_VIEWPORT = 3840

export function clampViewport(value: number): number {
  return Math.min(MAX_VIEWPORT, Math.max(MIN_VIEWPORT, Math.round(value)))
}

export function viewportForPreset(presetId: ViewportPresetId): Viewport {
  return { presetId, ...VIEWPORT_PRESETS[presetId] }
}

/** A typed size stops being a preset even when it happens to match one. */
export function customViewport(size: ViewportSize): Viewport {
  return {
    presetId: null,
    width: clampViewport(size.width),
    height: clampViewport(size.height)
  }
}
