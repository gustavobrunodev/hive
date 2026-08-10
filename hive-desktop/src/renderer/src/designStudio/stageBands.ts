/**
 * Design Studio (M18) — T4.8. What the Bancada does when it does not fit
 * (design.md §3.8).
 *
 * The tab lives in the `viewer` pane, ~44% of the window by default. Four
 * surfaces do not fit in that, and the failure mode of pretending they do is a
 * Studio where every column is too narrow to use — so the layout degrades on
 * purpose, in a fixed order, and **nothing ever becomes unreachable**: a
 * surface that loses its column gains a drawer, and the Telas are always in the
 * toolbar regardless of band.
 *
 * The order is chosen by how often each surface is *looked at*: the Inspetor is
 * consulted per selection and folds first; the Árvore and the Tela list are
 * navigation and fold second; the stage never folds, because it is the thing
 * being validated.
 */

export type StageBand = 'full' | 'inspectorDrawer' | 'compact'

/** At or above this the Bancada is complete: three columns. */
export const BAND_FULL_MIN = 1100
/** At or above this the left column survives; below it, only the stage keeps a column. */
export const BAND_INSPECTOR_MIN = 820
/** Below this the toolbar promotes Focus Mode — the window itself is the constraint. */
export const FOCUS_PROMOTION_MAX = 900

export interface StageLayout {
  band: StageBand
  /** Telas + Árvore as a resizable column. */
  leftColumn: boolean
  /** The Inspetor as a resizable column. */
  inspectorColumn: boolean
  /** The Árvore reachable from a drawer, because it has no column. */
  treeDrawer: boolean
  /** The Inspetor reachable from a drawer, because it has no column. */
  inspectorDrawer: boolean
  /** Offer Focus Mode with a hint — the stage is too cramped to be worth using as is. */
  promoteFocusMode: boolean
}

/**
 * An unmeasured stage (`0`, before the first layout pass) is treated as full.
 * Collapsing on a measurement that has not happened yet would flash every
 * surface into a drawer and back on every mount.
 */
export function bandFor(width: number): StageBand {
  if (width === 0 || width >= BAND_FULL_MIN) return 'full'
  return width >= BAND_INSPECTOR_MIN ? 'inspectorDrawer' : 'compact'
}

export function stageLayoutFor(width: number): StageLayout {
  const band = bandFor(width)
  return {
    band,
    leftColumn: band !== 'compact',
    inspectorColumn: band === 'full',
    treeDrawer: band === 'compact',
    inspectorDrawer: band !== 'full',
    promoteFocusMode: width > 0 && width < FOCUS_PROMOTION_MAX
  }
}
