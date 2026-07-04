import type { Meta, StoryObj } from "@storybook/react"

import { Button } from "../Button/Button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "./Dialog"

const meta = {
  title: "Overlays/Dialog",
  component: Dialog,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
A modal that interrupts the current task and demands focused, single-task
input before the user can return to what they were doing. Built on Radix's
\`Dialog.Root\`; this layer only adds tokenized styling and an explicit
\`aria-modal="true"\` (Radix's \`Dialog.Content\` does not set it despite
\`modal\` defaulting to \`true\` — see \`DialogContent\`'s implementation).

**When to use** — a focused, single-task capture or a piece of content the
user must consciously dismiss to keep working (a form that needs a few
fields, an inline preview, a short piece of legal/consent copy). **When not**
— for a yes/no confirmation before a consequential action, use \`AlertDialog\`
instead (it blocks Escape so the choice is always explicit); for a lightweight
edge-anchored task surface (multi-step forms, a settings drawer) prefer
\`Sheet\`; for content anchored to a trigger that doesn't need to block the
rest of the page, use \`Popover\`. Per this system's product register, Dialog
is not the first reach for validation or lightweight disclosure — inline
validation and \`Popover\` are tried first.

**Do's**
- Always pair \`DialogContent\` with a \`DialogTitle\` (use \`asChild\` +
  \`VisuallyHidden\` if the title shouldn't render visibly — never omit it,
  Radix warns and screen readers lose the accessible name).
- Keep the content to one task; if it grows past a short form, it's a
  candidate for a dedicated page or \`Sheet\`.
- Let \`DialogClose\` drive the cancel/dismiss action instead of manually
  calling \`onOpenChange(false)\` — it composes with \`asChild\` onto any
  element.

**Don'ts**
- Don't nest a Dialog inside another Dialog — stack a second modal surface
  only when there's truly no alternative (a confirmation *of* a dialog
  action should be \`AlertDialog\`, not a second \`Dialog\`).
- Don't disable the Escape/outside-click dismiss to force a choice — that's
  what \`AlertDialog\` exists for.

**A11y** — Radix supplies the focus trap (Tab/Shift+Tab cycle inside the
content), moves focus onto the content on open, restores it to the trigger
on close, and wires Escape/outside-click dismiss. This wrapper adds the
explicit \`aria-modal="true"\` the underlying primitive omits. Consumers still
owe: a real \`DialogTitle\` (visible or visually hidden) and a
\`DialogDescription\` when the dialog needs supporting copy (wired to
\`aria-describedby\` automatically).

**Relevant tokens** — \`--overlay\` (backdrop), \`--surface\`/\`--ink\` (panel),
\`--shadow-3\`, \`--z-modal\`, \`--rounded-lg\`, \`--s-5\` (padding), \`--ease-quart\`/
\`--ease-expo\` (enter/exit easing).
        `,
      },
    },
  },
} satisfies Meta<typeof Dialog>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Rename workspace</DialogTitle>
        <DialogDescription>
          Choose a new name for this workspace. This does not affect any files on disk.
        </DialogDescription>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--s-2)", marginTop: "var(--s-2)" }}>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button>Save</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  ),
}

/**
 * The brand register's diagonal-cut corner clip-path applied to the content
 * panel via `DialogContent`'s `cut` prop — opt-in for brand-adjacent
 * surfaces; product-register dialogs should leave it off (the default).
 */
export const CutCorner: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open cut-corner dialog</Button>
      </DialogTrigger>
      <DialogContent cut>
        <DialogTitle>Welcome to Hive</DialogTitle>
        <DialogDescription>
          A brand-register variant of the same Dialog primitive, using the diagonal cut-corner motif.
        </DialogDescription>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "var(--s-2)" }}>
          <DialogClose asChild>
            <Button>Got it</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  ),
}
