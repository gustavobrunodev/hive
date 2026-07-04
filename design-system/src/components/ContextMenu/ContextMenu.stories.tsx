import type { Meta, StoryObj } from "@storybook/react"

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "./ContextMenu"

const meta = {
  title: "Overlays/ContextMenu",
  component: ContextMenu,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
A right-click (or keyboard context-menu key, or long-press on touch) menu
anchored at the pointer, over an arbitrary surface — e.g. a file-tree row or
a canvas item — rather than a dedicated trigger button. Wraps Radix's
\`ContextMenu.Root\`; shares the same tokenized item/separator/label styling
as \`DropdownMenu\` so the two read as one visual language.

**When to use** — secondary actions on a specific item in a dense surface
(a file-tree node, a table row, a card) where right-click is the expected
gesture and a visible "..." button would add clutter to every row. **When
not** — if the action set should also be reachable without knowing to
right-click (most users won't discover it), pair it with — or replace it
with — a visible \`DropdownMenu\` trigger. Never make ContextMenu the *only*
way to reach an action that's otherwise necessary to complete a task.

**Do's**
- Wrap the exact surface that should respond to right-click with
  \`ContextMenuTrigger asChild\` — typically a row or card, not the whole page.
- Reuse the same item vocabulary (danger variant, shortcuts, separators,
  labels) as \`DropdownMenu\` for actions that appear in both, so the two
  menus don't drift apart visually.

**Don'ts**
- Don't suppress the browser's native context menu everywhere by mistake —
  scope the \`ContextMenuTrigger\` tightly so right-clicking outside the
  intended surface still gets the native menu (or whatever else is expected).
- Don't put the only entry point to a destructive action here without a
  visible alternative — see "When not" above.

**A11y** — Radix opens the menu via right-click, the keyboard "context menu"
key/Shift+F10, or long-press, and once open provides the same roving-tabindex
arrow-key navigation, type-ahead, and Escape/outside-click dismiss as
\`DropdownMenu\`. Because there's no visible trigger button, the accessible
entry point for keyboard users is the context-menu key while focus is on the
wrapped element — make sure that element itself is focusable (a row with
\`tabIndex={0}\`, a real button, etc.).

**Relevant tokens** — \`--surface\`/\`--ink\`, \`--border\`, \`--shadow-2\`,
\`--z-dropdown\`, \`--rounded-md\`/\`--rounded-sm\`, \`--surface-2\` on
\`[data-highlighted]\`, \`--danger-ink\`/\`--danger-bg\` for danger items.
        `,
      },
    },
  },
} satisfies Meta<typeof ContextMenu>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          tabIndex={0}
          style={{
            width: 320,
            height: 160,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px dashed var(--border-strong)",
            borderRadius: "var(--rounded-md)",
            color: "var(--muted)",
            fontSize: "0.875rem",
            userSelect: "none",
          }}
        >
          Right-click this area
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuLabel>src/index.ts</ContextMenuLabel>
        <ContextMenuItem shortcut="⌘C">Copy path</ContextMenuItem>
        <ContextMenuItem shortcut="⌘⏎">Open to the side</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="danger" shortcut="⌫">
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  ),
}
