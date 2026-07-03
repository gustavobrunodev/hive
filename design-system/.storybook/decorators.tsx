import React from "react"
import type { Decorator } from "@storybook/react"
import { ToastProvider } from "../src/components/Toast/Toast"
import { TooltipProvider } from "../src/components/Tooltip/Tooltip"

/* ============================================================================
 * Usage-section authoring template (impeccable rubric)
 * ============================================================================
 * Every Phase 2 component story (`<Name>.stories.tsx`, T11–T71) documents its
 * usage in the Meta's `parameters.docs.description.component` (or an MDX
 * `<Description>` block), structured as these four sections — depth scaled
 * to the component's real UX complexity (a primitive like Badge needs a
 * sentence per section; an overlay like Dialog earns real paragraphs):
 *
 *   1. When to use / When not — the real decision a consumer is making
 *      choosing this component over a sibling (e.g. Dialog vs Sheet vs
 *      Popover), stated concretely, not generically.
 *   2. Do's & Don'ts — concrete authored guidance grounded in this
 *      component's actual props/behavior, not generic advice restating the
 *      prop table.
 *   3. A11y — what Radix/this wrapper already gives you for free (roles,
 *      focus trap, keyboard map) and what the consumer is still responsible
 *      for (labels, focus targets, aria-describedby wiring, etc).
 *   4. Relevant tokens — which semantic role tokens (`--surface`, `--accent`,
 *      `--danger-*`, `--z-*`, …) the component consumes, so a consumer
 *      theming around it knows what to touch.
 *
 * Author with the `impeccable` skill; keep prose proportional, not padded.
 * ==========================================================================*/

/**
 * Wraps a story in `ToastProvider` so `useToast()` can publish inside the
 * canvas. `ToastProvider` renders its own `ToastViewport` internally — no
 * extra plumbing needed beyond mounting the provider itself.
 */
export const withToastProvider: Decorator = (Story) => (
  <ToastProvider>
    <Story />
  </ToastProvider>
)

/**
 * Wraps a story in `TooltipProvider`, required ancestor for any `Tooltip`
 * (shares hover/focus delay timing across triggers — see Tooltip.tsx).
 */
export const withTooltipProvider: Decorator = (Story) => (
  <TooltipProvider>
    <Story />
  </TooltipProvider>
)

/*
 * Portal theming: NOT provided here. `.storybook/preview.ts`'s `withTheme`
 * decorator already sets `data-theme` on `document.documentElement` (the
 * iframe's real `<html>`), and Radix portals mount to the iframe's `<body>`
 * — both inherit the same `:root[data-theme]` roles automatically. No
 * wrapper/context is needed for portalled content to pick up the theme; if
 * a future component surfaces a real exception to this, add a targeted
 * decorator here then (not preemptively).
 */

/**
 * Constrains a story to a fixed height with overflow, for components whose
 * layout/scroll behavior only appears with real geometry (jsdom has none —
 * see `.specs/codebase/CONCERNS.md`'s "Fragile Areas"): `ScrollArea`,
 * `Resizable`, `MessageList`. Apply per-story via that story's own
 * `decorators: [withFixedHeight(360)]`, not globally, since most components
 * don't need it.
 */
export function withFixedHeight(height: number | string = 320): Decorator {
  const resolvedHeight = typeof height === "number" ? `${height}px` : height

  const FixedHeightDecorator: Decorator = (Story) => (
    <div style={{ height: resolvedHeight, overflow: "auto", display: "flex", flexDirection: "column" }}>
      <Story />
    </div>
  )

  return FixedHeightDecorator
}
