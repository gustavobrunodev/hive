import type { Meta, StoryObj } from "@storybook/react"

import { Button } from "../Button/Button"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "./Sheet"

const meta = {
  title: "Overlays/Sheet",
  component: Sheet,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
An edge-anchored modal panel — a Dialog that slides in from a viewport edge
instead of centering. Built on the same Radix \`Dialog.Root\` as \`Dialog\`
(this is the only difference: the \`side\` prop on \`SheetContent\` picks which
edge it slides from and drives the \`data-side\`-scoped enter/exit transform),
so it inherits the identical focus trap, \`aria-modal="true"\`, and Escape/
outside-click dismiss behavior.

**When to use** — a task that benefits from more room than a centered Dialog
comfortably gives (a multi-field settings form, a multi-step wizard, item
details/edit panel) while still blocking the rest of the page, or when the
edge-anchored motion better matches the surface it's extending (a panel that
"belongs" to the right rail, for instance). **When not** — for a short,
single-task confirmation, a centered \`Dialog\` reads as more "modal" and is
the more familiar shape; for non-blocking supplementary content, \`Popover\`.

**Do's**
- Pick \`side\` to match the panel's conceptual origin (a right rail's detail
  view opens from \`"right"\`, a global command surface might open from
  \`"top"\`) rather than defaulting to \`"right"\` without thinking about it.
- Give the content a scrollable region if it can exceed the viewport height
  — \`hds-sheet-content\` already sets \`overflow-y: auto\`.

**Don'ts**
- Don't use Sheet as a sidebar/rail that's meant to stay open alongside the
  main content — it's still a modal overlay (backdrop + focus trap), not a
  persistent layout region.
- Don't skip \`SheetTitle\`/\`SheetDescription\` — same accessible-name
  requirement as Dialog applies here.

**A11y** — Identical contract to Dialog: Radix traps focus inside the
content, moves focus in on open and restores it to the trigger on close, and
wires Escape/outside-click dismiss; this wrapper adds the explicit
\`aria-modal="true"\` Radix omits by default.

**Relevant tokens** — \`--overlay\`, \`--surface\`/\`--ink\`, \`--shadow-3\`,
\`--z-modal\`, \`--s-5\` (padding); each \`side\`'s slide-in/out keyframes
animate \`transform\`/\`opacity\` only (translateX/Y), honoring
\`prefers-reduced-motion\` with a crossfade fallback.
        `,
      },
    },
  },
} satisfies Meta<typeof Sheet>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button>Open sheet</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetTitle>Session settings</SheetTitle>
        <SheetDescription>Adjust how this workspace behaves for the current session.</SheetDescription>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--s-2)", marginTop: "var(--s-4)" }}>
          <SheetClose asChild>
            <Button variant="ghost">Cancel</Button>
          </SheetClose>
          <SheetClose asChild>
            <Button>Save</Button>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  ),
}

/** All four edges a `SheetContent` can slide in from, via the `side` prop. */
export const Sides: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "var(--s-4)", flexWrap: "wrap" }}>
      {(["left", "right", "top", "bottom"] as const).map((side) => (
        <Sheet key={side}>
          <SheetTrigger asChild>
            <Button variant="ghost">{side}</Button>
          </SheetTrigger>
          <SheetContent side={side}>
            <SheetTitle style={{ textTransform: "capitalize" }}>{side} sheet</SheetTitle>
            <SheetDescription>Slides in from the {side} edge of the viewport.</SheetDescription>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "var(--s-4)" }}>
              <SheetClose asChild>
                <Button variant="ghost">Close</Button>
              </SheetClose>
            </div>
          </SheetContent>
        </Sheet>
      ))}
    </div>
  ),
}
