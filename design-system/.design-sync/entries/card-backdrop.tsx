import * as React from "react"

/**
 * cfg.provider target for the design-sync preview cards. The converter's
 * card HTML hardcodes a white `body` background (emit.mjs, which the
 * design-sync skill forbids forking — the app's self-check reads its exact
 * structure); this design system is dark-native (`.storybook/preview.ts`
 * defaults `data-theme="dark"`), so anything relying on the ambient page
 * background instead of an opaque fill of its own (ghost buttons, translucent
 * Alert/Toast/Badge variants, Empty) renders illegible on that white card.
 *
 * Painting a full-bleed `var(--bg)` panel behind the mounted story is the
 * only sanctioned lever available (cfg.provider + cfg.extraEntries) that
 * doesn't touch emit.mjs.
 *
 * Setting cfg.provider turned out to skip bundling `.storybook/preview.ts`'s
 * decorators ENTIRELY (build log: "decorator auto-detect skipped — cfg.provider
 * is set") — `window.__dsDecorate` isn't just superseded, it's never defined,
 * so the `withTheme` decorator's `data-theme="dark"` side effect silently
 * stopped firing (confirmed empirically: `--bg` resolved to the light-theme
 * value with `data-theme` absent from `<html>`). withTheme's own logic is
 * trivial — the DS's stories always run with `initialGlobals.theme: "dark"`
 * (see .storybook/preview.ts) — so this component replicates that one
 * side effect directly instead of depending on the now-absent decorator
 * bundle. If this DS ever adds more `.storybook/preview.ts` decorators
 * beyond `withTheme`, they'd need replicating here too (or reconsider
 * dropping cfg.provider in favor of a narrower fix).
 *
 * Deliberately `position: absolute`, not `fixed`, on the backdrop div. The
 * card's own `.ds-cell`/`.ds-single` wrapper (emit.mjs) sets
 * `transform: translateZ(0)`, which per spec makes it the containing block
 * for an absolutely-positioned descendant too — so `inset: 0` here fills
 * exactly that cell, no extra wrapper needed. `position: fixed` was tried
 * first and rejected: validate's grid-overflow detector flags ANY visible
 * `position: fixed` element as an escaping overlay
 * (`getComputedStyle(el).position === 'fixed'` plus a visibility check — it
 * doesn't verify actual escape), which mis-flagged every single component in
 * the roster as `[GRID_OVERFLOW] escape`.
 */
export function CardBackdrop({ children }: { children?: React.ReactNode }) {
  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", "dark")
  }, [])

  return (
    <>
      <div
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, background: "var(--bg)", zIndex: -1 }}
      />
      {children}
    </>
  )
}
