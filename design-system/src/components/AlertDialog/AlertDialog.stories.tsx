import type { Meta, StoryObj } from "@storybook/react"

import { Button } from "../Button/Button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./AlertDialog"

const meta = {
  title: "Overlays/AlertDialog",
  component: AlertDialog,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
A confirmation modal for consequential or destructive actions that must not
be dismissed by accident. Wraps Radix's \`AlertDialog.Root\`. Radix already
blocks outside-click dismiss by default; this wrapper additionally overrides
\`onEscapeKeyDown\` (calling \`event.preventDefault()\` after any consumer
handler runs) because Radix's AlertDialog does **not** block Escape on its
own — it falls through to the underlying Dialog primitive's default
close-on-Escape. The result: the only way out is \`AlertDialogAction\` or
\`AlertDialogCancel\`, matching this system's requirement that a destructive
choice is always explicit.

**When to use** — before an irreversible or hard-to-undo action (delete,
overwrite, discard unsaved changes, revoke access). **When not** — for
anything that isn't a yes/no gate on a consequential action; a plain
\`Dialog\` (dismissible via Escape/outside-click) is the right choice for
everyday focused-task capture, and \`Toast\`/inline validation is right for
non-blocking feedback. Don't reach for AlertDialog just because something
"feels important" — reserve the forced choice for genuinely destructive or
irreversible operations, or its urgency stops registering.

**Do's**
- Give \`AlertDialogAction\` the \`variant="danger"\` tint when the action
  deletes or destroys data, so the button's color reinforces the copy.
- Word the title and description around the specific consequence ("Delete
  \`main.ts\`? This can't be undone.") rather than a generic "Are you sure?".
- Always render an \`AlertDialogCancel\` — it's the safe, expected escape
  hatch even though Escape/outside-click are blocked.

**Don'ts**
- Don't override \`onEscapeKeyDown\`/\`onInteractOutside\` yourself to "fix"
  the blocked dismiss — it's intentional, not a bug, per spec.
- Don't use AlertDialog for informational-only content with a single
  acknowledgement button and no real alternative choice; that's a plain
  Dialog (or no modal at all).

**A11y** — Radix moves focus into the content on open and restores it to the
trigger on close, same as Dialog. This wrapper adds \`aria-modal="true"\`
(also omitted by Radix by default). Verified by reading \`AlertDialogContent\`'s
source rather than by an interactive Playwright Escape-press in this story
(the override is a synchronous \`preventDefault\`, not a visually distinct
state, so source inspection is the reliable way to confirm it — screenshotting
"nothing happened" isn't meaningfully different from a dropped keypress).

**Relevant tokens** — \`--overlay\`, \`--surface\`/\`--ink\`, \`--shadow-3\`,
\`--z-modal\`, \`--rounded-lg\`; \`--accent\`/\`--accent-ink\` for the default
action, \`--danger\`/\`--danger-ink\` for the danger variant, \`--focus\` on
both buttons' \`:focus-visible\` ring.
        `,
      },
    },
  },
} satisfies Meta<typeof AlertDialog>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button>Sign out</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>Sign out of this workspace?</AlertDialogTitle>
        <AlertDialogDescription>
          Any unsaved changes in open files will be discarded. This is not reversible.
        </AlertDialogDescription>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <AlertDialogCancel asChild>
            <Button variant="ghost">Cancel</Button>
          </AlertDialogCancel>
          <AlertDialogAction>Sign out</AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  ),
}

/** `variant="danger"` tints the action button for destructive operations (e.g. delete). */
export const Danger: Story = {
  render: () => (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost">Delete repository</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>Delete "harness-builder"?</AlertDialogTitle>
        <AlertDialogDescription>
          This permanently deletes the repository, its history, and all local branches. This can't be undone.
        </AlertDialogDescription>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <AlertDialogCancel asChild>
            <Button variant="ghost">Cancel</Button>
          </AlertDialogCancel>
          <AlertDialogAction variant="danger">Delete</AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  ),
}
