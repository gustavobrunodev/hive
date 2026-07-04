import type { Meta, StoryObj } from "@storybook/react"

import { withToastProvider } from "../../../.storybook/decorators"
import { Button } from "../Button/Button"
import { useToast } from "./Toast"

/**
 * Fires a toast on click so the component is actually operable in canvas —
 * `useToast()` requires a `ToastProvider` ancestor, wired here via the
 * `withToastProvider` decorator (mounts the provider once per story, which
 * also renders the `ToastViewport` the toasts portal into).
 */
function ToastDemo({
  variant = "info",
  title = "Saved",
  description = "Your changes were saved.",
}: {
  variant?: "info" | "success" | "warning" | "danger"
  title?: string
  description?: string
}) {
  const { toast } = useToast()
  return (
    <Button variant="ghost" cut={false} onClick={() => toast({ title, description, variant })}>
      Trigger {variant} toast
    </Button>
  )
}

const meta = {
  title: "Feedback/Toast",
  component: ToastDemo,
  tags: ["autodocs"],
  decorators: [withToastProvider],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
A transient, portaled notification for the result of something the user just
did (saved, sent, failed, undone) — not for content the page always shows.

**When to use / when not:** reach for Toast when an action just completed and
the confirmation only matters for a few seconds (save, copy, delete-with-undo).
Reach for **Alert** instead when the message needs to persist as part of the
page (a form-level validation summary, a banner that stays until resolved) —
a Toast that auto-dismisses in 5s is the wrong home for something the user
needs to still see after they look away and back.

**Do's & Don'ts**
- Do keep the \`title\` short and the \`description\` optional supporting detail — the viewport is capped at 380px wide.
- Do pick \`variant\` by what actually happened (\`danger\` for a failure, not just to grab attention).
- Don't stack more than a couple toasts; publishing many in a burst reads as noise, not information — batch the underlying action instead.
- Don't put the *only* copy of critical information in a toast; it disappears after \`duration\` (default 5000ms) unless the user hovers/focuses it.

**Accessibility:** Radix's \`Toast.Provider\`/\`Root\` supply the live region
(each toast renders inside a \`role="status"\` announcer), the auto-dismiss
timer, pause-on-hover/focus for the whole viewport, and swipe-to-dismiss —
none of that is reimplemented here. \`ToastClose\` ships a default
\`aria-label="Dismiss"\`. The one thing a consumer still owns: keep \`title\`
text meaningful on its own, since screen readers announce it without visual
context.

**Tokens:** \`--surface\`/\`--ink\`/\`--border\` for the card; \`--info\`/\`--success\`/\`--warning\`/\`--danger\`
for the left accent stripe (Toast is the one place in this system a stripe
border is correct — it's a transient portaled notification, not inline page
content, which is why Alert deliberately uses a different treatment);
\`--z-toast\` for stacking above modals but below tooltips; \`--shadow-2\` for elevation.
        `,
      },
    },
  },
} satisfies Meta<typeof ToastDemo>

export default meta

type Story = StoryObj<typeof meta>

export const Info: Story = {
  args: { variant: "info", title: "Heads up", description: "A new version is available." },
}

export const Success: Story = {
  args: { variant: "success", title: "Saved", description: "Your changes were saved." },
}

export const Warning: Story = {
  args: { variant: "warning", title: "Check your input", description: "One field needs attention." },
}

export const Danger: Story = {
  args: { variant: "danger", title: "Failed to save", description: "Something went wrong. Try again." },
}

/** All four semantic variants side by side, each with its own trigger. */
export const AllVariants: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      <ToastDemo variant="info" title="Heads up" description="A new version is available." />
      <ToastDemo variant="success" title="Saved" description="Your changes were saved." />
      <ToastDemo variant="warning" title="Check your input" description="One field needs attention." />
      <ToastDemo variant="danger" title="Failed to save" description="Something went wrong. Try again." />
    </div>
  ),
}
