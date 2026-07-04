import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react"

import { Button } from "../Button/Button"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "./Command"

const meta = {
  title: "Overlays/Command",
  component: Command,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
A fuzzy-searchable command surface built on \`cmdk\`'s \`Command\` primitive —
type to filter a flat or grouped list of actions down to what matches. Used
either bare/inline (embedded directly in a page, e.g. a settings search) or
composed inside \`CommandDialog\` for a global ⌘K-style palette.

Notably, \`CommandDialog\` does **not** use cmdk's own bundled
\`CommandDialog\` — that component wraps a second, separate Radix Dialog
instance (and, like this system's own Dialog, doesn't set \`aria-modal\`
either). Instead, this system's \`CommandDialog\` composes cmdk's bare
\`Command\` root inside this design system's own already-built \`Dialog\`, so
the palette reuses one focus trap, one Escape/outside-click contract, one
explicit \`aria-modal="true"\`, and one z-index/motion system instead of
shipping two different dialog implementations side by side.

**When to use** — a searchable list of many possible actions/destinations
where typing to filter is faster than scanning (a global command palette, a
searchable settings list). **When not** — for a short, fixed list of a
handful of actions, \`DropdownMenu\`/\`ContextMenu\` are simpler and don't ask
the user to type first.

**Do's**
- Always include \`CommandInput\` plus a \`CommandEmpty\` fallback so an
  unmatched query has a clear "no results" state instead of an empty void.
- Group related items with \`CommandGroup\`/\`CommandSeparator\` when the list
  spans more than one category (e.g. "Suggestions" vs "Settings").
- Give \`CommandDialog\` a descriptive \`label\` (visually hidden, defaults to
  \`"Command palette"\`) — it's the dialog's only accessible name.

**Don'ts**
- Don't reach for cmdk's own \`CommandDialog\` export in this codebase — it
  bypasses this system's Dialog wrapper and its a11y/motion guarantees.
- Don't rely on mouse-only interaction — cmdk's list navigation is
  keyboard-first (Arrow keys + Enter) by design; verify keyboard selection
  when adding new item sets.

**A11y** — cmdk renders \`role="listbox"\`/\`"option"\`/\`"combobox"\` structure
and manages \`aria-selected\` as the highlighted item changes with the arrow
keys or filtered results. Inside \`CommandDialog\`, this system's \`Dialog\`
supplies the focus trap, \`aria-modal="true"\`, and Escape/outside-click
dismiss — cmdk itself doesn't provide those (its own \`CommandDialog\` would
have to, redundantly, if used instead).

**Relevant tokens** — \`--surface\`/\`--ink\`, \`--border\` (input divider),
\`--surface-2\` on \`[aria-selected="true"]\`, \`--muted\`/\`--faint\` for the
search icon/placeholder/empty state, \`--rounded-sm\` on items, plus
Dialog's own \`--overlay\`/\`--shadow-3\`/\`--z-modal\` when composed inside
\`CommandDialog\`.
        `,
      },
    },
  },
} satisfies Meta<typeof Command>

export default meta

type Story = StoryObj<typeof meta>

const demoList = (
  <>
    <CommandInput placeholder="Type a command or search..." />
    <CommandList>
      <CommandEmpty />
      <CommandGroup heading="Suggestions">
        <CommandItem shortcut="⌘P">Go to file</CommandItem>
        <CommandItem shortcut="⌘⇧P">Command palette</CommandItem>
        <CommandItem shortcut="⌘B">Toggle sidebar</CommandItem>
      </CommandGroup>
      <CommandSeparator />
      <CommandGroup heading="Settings">
        <CommandItem shortcut="⌘,">Preferences</CommandItem>
        <CommandItem>Keyboard shortcuts</CommandItem>
        <CommandItem>Theme</CommandItem>
      </CommandGroup>
    </CommandList>
  </>
)

/** Bare `Command`, embedded inline — not an overlay, just the search/filter surface directly in the canvas. */
export const Inline: Story = {
  render: () => (
    <div style={{ width: 360, border: "1px solid var(--border)", borderRadius: "var(--rounded-md)" }}>
      <Command>{demoList}</Command>
    </div>
  ),
}

/** `CommandDialog` composed inside this system's own `Dialog` — click to open, then type to filter. */
export const Palette: Story = {
  render: function Render() {
    const [open, setOpen] = useState(false)
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open command palette</Button>
        <CommandDialog open={open} onOpenChange={setOpen} label="Command palette">
          {demoList}
        </CommandDialog>
      </>
    )
  },
}
