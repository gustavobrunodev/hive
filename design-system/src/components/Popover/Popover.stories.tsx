import type { Meta, StoryObj } from "@storybook/react"

import { Button } from "../Button/Button"
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "./Popover"

const meta = {
  title: "Overlays/Popover",
  component: Popover,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
A non-modal floating panel anchored to its trigger — for supplementary
content, a small form, or a set of options that don't need to block the rest
of the page. Wraps Radix's \`Popover.Root\`; this layer supplies tokenized
styling, an \`Arrow\` matched to the surface, and leaves \`avoidCollisions\`
at Radix's default (on), so the panel flips/shifts to stay in the viewport
instead of clipping against an overflow ancestor.

**When to use** — progressive disclosure of secondary info/actions tied to a
specific trigger (a filter's options, a user's card preview, an inline
"edit" form) where the rest of the page should stay interactive and visible.
**When not** — if the content must be read/acted on before anything else can
happen, that's a modal (\`Dialog\`/\`AlertDialog\`); if it's a short, non-focusable
hint with no interactive content, that's \`Tooltip\`; if it's a list of
discrete actions, \`DropdownMenu\` gives you roving-tabindex keyboard nav for
free. Per this system's product register, Popover (not Dialog) is the first
reach for lightweight disclosure and inline validation.

**Do's**
- Use \`side\`/\`align\` (Radix \`Content\` props) to pick a placement that
  keeps the panel near its trigger and unobstructed; let collision avoidance
  handle edge cases rather than hardcoding a side that clips on smaller
  viewports.
- Use \`PopoverAnchor\` when the panel should track a different element than
  the one that opens it (e.g. a text selection).
- Compose \`PopoverClose\` onto an in-content button for an explicit dismiss
  action, in addition to Escape/outside-click.

**Don'ts**
- Don't put a multi-step flow or a form that needs a focus trap inside a
  Popover — Radix doesn't trap focus here the way it does for Dialog; reach
  for \`Dialog\`/\`Sheet\` once the content needs to hold focus hostage.
- Don't stack a Popover from inside another Popover/menu; flatten the
  interaction instead.

**A11y** — Radix moves focus into the content on open and restores it to
the trigger on close, wires Escape/outside-click dismiss, and handles
edge-aware repositioning. Consumers are responsible for a meaningful
accessible name on the trigger (visible text or \`aria-label\`) and for
labeling any interactive controls placed inside the content.

**Relevant tokens** — \`--surface\`/\`--ink\`, \`--border\`, \`--shadow-2\`,
\`--z-overlay\`, \`--rounded-md\`, \`--s-4\` (padding), \`--focus\` (content
focus ring).
        `,
      },
    },
  },
} satisfies Meta<typeof Popover>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost">Filters</Button>
      </PopoverTrigger>
      <PopoverContent>
        <p style={{ margin: "0 0 8px", fontWeight: 600 }}>Filter by status</p>
        <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.875rem" }}>
          Choose which task states appear in the list.
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "var(--s-3)" }}>
          <PopoverClose asChild>
            <Button variant="ghost">Close</Button>
          </PopoverClose>
        </div>
      </PopoverContent>
    </Popover>
  ),
}

/** Placement variants via Radix's own `side`/`align` props on `PopoverContent`. */
export const Placements: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "var(--s-6)", flexWrap: "wrap", padding: "var(--s-7)" }}>
      {(["top", "right", "bottom", "left"] as const).map((side) => (
        <Popover key={side}>
          <PopoverTrigger asChild>
            <Button variant="ghost">{side}</Button>
          </PopoverTrigger>
          <PopoverContent side={side}>
            <p style={{ margin: 0, fontSize: "0.875rem" }}>Anchored to the {side} side.</p>
          </PopoverContent>
        </Popover>
      ))}
    </div>
  ),
}
