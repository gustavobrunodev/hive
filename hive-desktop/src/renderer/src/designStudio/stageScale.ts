/**
 * Design Studio (M18) — T4.6. Fitting a 1440px device into a 700px bench
 * without lying about it (D-DS-7, design.md §3.3).
 *
 * **The iframe is never resized. The container is scaled.** Shrinking the
 * iframe to fit would change the width the document inside it sees, so the
 * design system's media queries would answer for a 700px viewport while the
 * readout said "Desktop" — the Preview would be confidently wrong about the one
 * thing it exists to show. Scaling the container leaves the frame at the real
 * 1440px and only changes how big it looks.
 *
 * **It never magnifies.** `k` is capped at 1: a mobile Tela shown at 180% would
 * be a Preview of a device nobody has, and every judgement made on it — tap
 * target sizes, line lengths, how cramped a header feels — would be wrong in
 * the flattering direction.
 */

/** Breathing room between the device and the bench edges, both sides together. */
export const STAGE_MARGIN = 64

/**
 * Below this the Preview stops being readable and the number stops being
 * useful; the bench scrolls instead of shrinking further.
 */
export const MIN_SCALE = 0.1

/**
 * The scale factor for a device of `deviceWidth` on a bench of `stageWidth`.
 * An unmeasured bench (`0`, the first paint before layout) reports 1 rather
 * than a scale computed from nothing — a Preview that flashes at 4% and then
 * jumps is worse than one that appears at full size and settles.
 */
export function scaleFor(
  stageWidth: number,
  deviceWidth: number,
  margin: number = STAGE_MARGIN
): number {
  if (stageWidth <= 0 || deviceWidth <= 0) return 1
  const available = stageWidth - margin
  if (available <= 0) return MIN_SCALE
  return Math.max(MIN_SCALE, Math.min(1, available / deviceWidth))
}

/** `0.75` → `'75%'`. Whole percents: the readout is a reassurance, not a measurement. */
export function formatScale(scale: number): string {
  return `${Math.round(scale * 100)}%`
}

/**
 * `'1440 × 900 · 75%'` — the device's real size first, the reduction second, so
 * the user always knows they are looking at something smaller than the truth.
 */
export function formatReadout(width: number, height: number, scale: number): string {
  return `${width} × ${height} · ${formatScale(scale)}`
}
