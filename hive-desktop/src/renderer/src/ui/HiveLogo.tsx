import { Logo } from '@hive/design-system'

export interface HiveLogoProps {
  /**
   * `lockup` (default) is the horizontal mark-then-wordmark identity for app
   * chrome; `mark` is the symbol on its own, for surfaces where the name is
   * already spelled out next to it.
   */
  mark?: 'lockup' | 'mark'
  className?: string
  /**
   * Overrides the DS's generic "Hive" label — the title bar announces the full
   * product name, since there the lockup replaces the name in text.
   */
  'aria-label'?: string
}

/**
 * The Hive identity, as this app wears it.
 *
 * It is a thin pass to the DS `Logo` at `tone="current"` — the one tone whose
 * artwork is `currentColor` throughout — for two reasons the previous version
 * paid for in workarounds:
 *
 *  - **Theming.** The `black`/`white` lockups bake their fill into the SVG, so
 *    a themed app had to render both and hide the wrong one with a
 *    `data-theme` rule. Adding a third theme would have meant a third decision
 *    in CSS about which of two elements to show. `currentColor` makes it one
 *    element that follows `--ink`, whatever the theme resolves it to.
 *  - **Sizing.** The delivered stacks sit on a 1408×768 canvas the artwork
 *    fills ~20% of, so a `height: 20px` painted a ~4px mark; this component
 *    used to rewrite the `viewBox` from a layout effect to compensate. The
 *    chrome marks are cropped to the artwork, so CSS height means what it says
 *    and the effect is gone.
 *
 * Color is the caller's business, via `--hds-logo-mark` / `--hds-logo-wordmark`
 * (see `workbench.css`): the app paints the mark in `--accent` and the wordmark
 * in `--ink`, which is the one place brand color is identity rather than
 * decoration.
 */
export function HiveLogo({
  mark = 'lockup',
  className,
  'aria-label': ariaLabel
}: HiveLogoProps): React.JSX.Element {
  // Spread conditionally: the DS sets `aria-label="Hive"` and then spreads the
  // rest over it, so passing an explicit `undefined` would *delete* the label
  // rather than leave the default in place.
  return (
    <Logo
      tone="current"
      mark={mark}
      className={className}
      {...(ariaLabel === undefined ? {} : { 'aria-label': ariaLabel })}
    />
  )
}
