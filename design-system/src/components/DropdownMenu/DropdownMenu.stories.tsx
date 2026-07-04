import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react"

import { Button } from "../Button/Button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./DropdownMenu"

const meta = {
  title: "Overlays/DropdownMenu",
  component: DropdownMenu,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
A click-to-open menu of actions/options anchored to a trigger button. Wraps
Radix's \`DropdownMenu.Root\`; this layer supplies tokenized styling for the
panel and its items (\`Item\`/\`CheckboxItem\`/\`RadioItem\`/\`Separator\`/\`Label\`)
plus a \`shortcut\` slot on \`Item\` for a right-aligned key-combo hint.

**When to use** — a discrete list of actions or mutually-exclusive/toggle
options triggered by a click on a clearly-a-menu affordance (a "..." button,
a named action button). **When not** — for a right-click-anywhere menu on an
arbitrary surface, use \`ContextMenu\` (same visual language, different
trigger gesture); for a fuzzy-searchable list of many commands, use
\`Command\`; for a single supplementary panel that isn't a list of actions,
\`Popover\` is a better fit.

**Do's**
- Group related items with \`DropdownMenuSeparator\`, and label groups with
  \`DropdownMenuLabel\` when the menu mixes several kinds of actions.
- Use \`variant="danger"\` on \`DropdownMenuItem\` for destructive actions so
  color reinforces intent, and pair with \`AlertDialog\` if the action is
  also irreversible.
- Use \`DropdownMenuCheckboxItem\`/\`DropdownMenuRadioItem\` for toggle/choice
  state that lives inside the menu itself, not a plain \`Item\` with manual
  checkmark text.

**Don'ts**
- Don't put more than one or two levels of grouping in a single menu — if it
  needs a submenu tree, reconsider whether a page or \`Command\` palette
  serves the user better.
- Don't rely on the \`shortcut\` slot to *register* the keyboard shortcut —
  it's a visual hint only; wire the actual keybinding separately.

**A11y** — Radix gives the trigger \`aria-haspopup\`/\`aria-expanded\`,
provides full arrow-key roving-tabindex navigation between items once open,
type-ahead (typing jumps to a matching item), and Escape/outside-click
dismiss with focus restored to the trigger.

**Relevant tokens** — \`--surface\`/\`--ink\`, \`--border\`, \`--shadow-2\`,
\`--z-dropdown\`, \`--rounded-md\`/\`--rounded-sm\`; \`--surface-2\` on
\`[data-highlighted]\`, \`--danger-ink\`/\`--danger-bg\` for danger items,
\`--faint\` for disabled items, \`--muted\` for labels/shortcuts.
        `,
      },
    },
  },
} satisfies Meta<typeof DropdownMenu>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost">Actions</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>File</DropdownMenuLabel>
        <DropdownMenuItem shortcut="⌘R">Rename</DropdownMenuItem>
        <DropdownMenuItem shortcut="⌘D">Duplicate</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="danger" shortcut="⌫">
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
}

/** Checkbox and radio items carry their own toggle/choice state — arrow keys move between all item kinds. */
export const WithCheckboxesAndRadios: Story = {
  render: function Render() {
    const [wrap, setWrap] = useState(true)
    const [minimap, setMinimap] = useState(false)
    const [theme, setTheme] = useState("system")

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost">View options</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Editor</DropdownMenuLabel>
          <DropdownMenuCheckboxItem checked={wrap} onCheckedChange={setWrap}>
            Word wrap
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem checked={minimap} onCheckedChange={setMinimap}>
            Minimap
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Theme</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
            <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  },
}
