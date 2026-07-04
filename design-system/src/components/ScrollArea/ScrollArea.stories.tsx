import type { Meta, StoryObj } from "@storybook/react"

import { withFixedHeight } from "../../../.storybook/decorators"
import { ScrollArea } from "./ScrollArea"

function LongList({ count = 40 }: { count?: number }) {
  return (
    <div style={{ padding: "4px 16px 4px 4px" }}>
      {Array.from({ length: count }, (_, i) => (
        <p key={i} style={{ margin: "0 0 12px" }}>
          Row {i + 1} — file_explorer/src/components/example-{i + 1}.tsx
        </p>
      ))}
    </div>
  )
}

function WideRow() {
  return (
    <div style={{ padding: "4px 4px 16px", whiteSpace: "nowrap", fontFamily: "var(--ff-num, monospace)" }}>
      This single row of text is intentionally much wider than the viewport so the horizontal scrollbar appears
      alongside the vertical one — resize the pane or scroll sideways to see the corner fill.
      <br />
      Second wide row to give the vertical scrollbar something to do at the same time as the horizontal one.
    </div>
  )
}

const meta = {
  title: "Layout/ScrollArea",
  component: ScrollArea,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: `
A viewport with a tokenized, thumb-only scrollbar overlay — wraps Radix's
\`ScrollArea.Root\`/\`Viewport\`/\`Scrollbar\`/\`Thumb\`/\`Corner\`. The real
scrolling node is always a genuine \`overflow: auto\` element underneath the
custom visuals, so native scrolling (wheel, trackpad, keyboard, touch) keeps
working even where the custom scrollbar chrome doesn't render.

**When to use / when not** — Use \`ScrollArea\` for any fixed-height or
fixed-width region whose content can overflow (a message log, a file tree, a
long settings panel) where you want the scrollbar to match the DS's tokens
instead of the OS/browser default. Don't reach for it just to add
\`overflow: auto\` to a full-page layout — plain native scrolling is correct
there; this component earns its place inside a *bounded* pane (see
\`withFixedHeight\` in these stories) where an OS scrollbar would look like an
Electron seam (PRODUCT.md's anti-reference: "no default OS scrollbars
fighting the rest of the interface").
**Do's & Don'ts**
- Do give the \`Root\` (or an ancestor) an explicit height/width — \`ScrollArea\`
  has no opinion on its own size; without a bound, there is nothing to
  overflow and no scrollbar appears.
- Do use the \`viewportRef\` prop when a consumer needs the real scroll
  position (e.g. a pin-to-latest chat log) — the \`ScrollArea\` ref itself only
  reaches the outer wrapper, not the scrolling node.
- Don't nest interactive overlays (Popover/Tooltip/DropdownMenu) expecting
  them to be visually clipped by the viewport — Radix portals them to
  \`document.body\`, so they render above the scroll clip, not inside it.
- Don't hand-roll scrollbar CSS on top of this component — the thumb-only,
  no-arrows/no-track style is a deliberate restraint (PRODUCT.md bans
  "reinvented scrollbars"); extend via tokens, not new chrome.

**A11y** — The real \`overflow: auto\` viewport means every native scroll
input (wheel, trackpad, touch, keyboard \`PageUp\`/\`PageDown\`/arrow keys once
focused) works exactly as a user expects; the custom thumb is a visual layer
on top, never a replacement input. \`type="hover"\` (the default) shows the
scrollbar on hover/scroll and hides it after \`scrollHideDelay\`; use
\`type="always"\` if the content region needs a persistently visible affordance
(e.g. to signal "this list is longer than it looks").

**Relevant tokens** — \`--border-strong\` (thumb), \`--muted\` (thumb hover),
\`--rounded-full\` (thumb radius); no surface/background tokens since the
scrollbar chrome itself is transparent over its content.
`,
      },
    },
  },
} satisfies Meta<typeof ScrollArea>

export default meta

type Story = StoryObj<typeof meta>

/** Vertical overflow inside a `withFixedHeight` pane — the primary use case (a scrollable list/log). */
export const VerticalOverflow: Story = {
  decorators: [withFixedHeight(280)],
  args: {
    "aria-label": "File list",
    children: <LongList />,
  },
}

/** `type="always"` keeps the scrollbar visible without hover/scroll, useful when overflow itself is a signal. */
export const AlwaysVisible: Story = {
  decorators: [withFixedHeight(220)],
  args: {
    type: "always",
    "aria-label": "File list",
    children: <LongList count={20} />,
  },
}

/** Both axes overflow at once — the `Corner` element fills the gap between the two scrollbars. */
export const BothAxes: Story = {
  decorators: [withFixedHeight(220)],
  args: {
    type: "always",
    "aria-label": "Wide content",
    children: (
      <>
        <WideRow />
        <LongList count={15} />
      </>
    ),
  },
}
