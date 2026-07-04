import type { Meta, StoryObj } from "@storybook/react"

import { Alert } from "./Alert"

function InfoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 9v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="10" cy="6.5" r="0.9" fill="currentColor" />
    </svg>
  )
}

const meta = {
  title: "Feedback/Alert",
  component: Alert,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: `
An inline, static message box for semantic state — a persistent page notice,
not a transient one.

**When to use / when not:** use Alert for content that belongs in the page's
flow and should stay visible until the user resolves or dismisses it (a
form-level validation summary, a persistent banner, a settings-page warning).
Use **Toast** instead for the result of an action that just happened and only
needs a few seconds of visibility — Alert renders a full tinted background
with a full-perimeter border precisely because it reads as durable page
content, never the side-stripe treatment Toast uses for its transient
portaled card. Use **Callout** instead for brand-register marketing copy
(docs pages, landing sections) — Callout carries its own gate/limits
vocabulary and dashed-brand styling, not the semantic info/success/warning/danger set.

**Do's & Don'ts**
- Do choose \`variant\` by the actual severity of the message — \`danger\` should mean the user must act, not just that the copy sounds negative.
- Do keep \`title\` to a short label and put detail in the body — the box doesn't scroll or truncate long content, so it will grow to fit whatever's given.
- Don't add \`role="alert"\` for content that's already present at first paint (a static page notice) — that's for cases where the Alert is mounted dynamically in response to an action; the component itself deliberately sets no \`role\` by default so callers make that call explicitly (see the component's own doc comment).

**Accessibility:** no live-region role is set by default — this is intentional
per the component's own design note: an Alert is frequently static page
content already in the accessibility tree at first render, so forcing
\`role="alert"\` would misleadingly announce it as freshly injected. When an
Alert *is* mounted dynamically (e.g. after a failed submit), pass
\`role="alert"\` (assertive) or \`role="status"\` (polite) yourself. The optional
\`icon\` slot is rendered \`aria-hidden\` since it's decorative alongside the
text content.

**Tokens:** per-variant pairs — \`--info\`/\`--info-bg\`/\`--info-ink\`,
\`--success\`/\`--success-bg\`/\`--success-ink\`, \`--warning\`/\`--warning-bg\`/\`--warning-ink\`,
\`--danger\`/\`--danger-bg\`/\`--danger-ink\` — for the border/background/text triad per tone.
        `,
      },
    },
  },
  args: {
    variant: "info",
    title: "Heads up",
    children: "This is an inline notice that stays on the page until resolved.",
  },
  argTypes: {
    variant: {
      control: "radio",
      options: ["info", "success", "warning", "danger"],
    },
  },
} satisfies Meta<typeof Alert>

export default meta

type Story = StoryObj<typeof meta>

export const Info: Story = {
  args: { variant: "info", title: "Heads up", children: "A new version of this page is available." },
}

export const Success: Story = {
  args: { variant: "success", title: "All set", children: "Your changes were saved successfully." },
}

export const Warning: Story = {
  args: {
    variant: "warning",
    title: "Check before continuing",
    children: "This action can't easily be undone once submitted.",
  },
}

export const Danger: Story = {
  args: { variant: "danger", title: "Something went wrong", children: "We couldn't save your changes. Try again." },
}

export const WithIcon: Story = {
  args: {
    variant: "info",
    icon: <InfoIcon />,
    title: "Heads up",
    children: "A new version of this page is available.",
  },
}

export const WithoutTitle: Story = {
  args: {
    variant: "warning",
    title: undefined,
    children: "This action can't easily be undone once submitted.",
  },
}

/** All four tones side by side for a quick comparison. */
export const AllVariants: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Alert variant="info" title="Heads up">
        A new version of this page is available.
      </Alert>
      <Alert variant="success" title="All set">
        Your changes were saved successfully.
      </Alert>
      <Alert variant="warning" title="Check before continuing">
        This action can't easily be undone once submitted.
      </Alert>
      <Alert variant="danger" title="Something went wrong">
        We couldn't save your changes. Try again.
      </Alert>
    </div>
  ),
}
