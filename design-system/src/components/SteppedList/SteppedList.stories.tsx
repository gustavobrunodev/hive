import type { Meta, StoryObj } from "@storybook/react"

import { SteppedList, SteppedListItem } from "./SteppedList"

const USAGE = `
**When to use / when not** — SteppedList is a compact, numbered vertical
sequence for short setup/how-it-works copy (3–6 steps, title + one line of
description each) — think "how to get started" cards, not a full onboarding
wizard. For a richer step with skill chips, sub-steps, and a highlighted
"you are here" node, reach for \`Timeline\`'s \`Step\`/\`Steps\` instead; for
switching between already-completed/available views, use \`Tabs\`.

**Do's & Don'ts**
- Do keep each step to a short \`title\` + one-sentence \`description\` — the
  connector line and counter badge are sized for compact copy, not
  paragraphs.
- Do use \`children\` (in addition to, or instead of, \`description\`) when a
  step needs richer content like a code snippet or a list — both render, in
  order, inside the same \`<li>\`.
- Don't expect an \`active\`/\`current\` prop — none exists on
  \`SteppedListItemProps\`; the component is purely sequential numbering via
  CSS \`counter()\`. If a specific step needs emphasis, style it directly via
  the item's own \`className\` (see the "Current step emphasized" story) —
  don't fork the component for it.
- Don't drop items out of the \`<ol>\`/skip using \`SteppedListItem\` for a
  step — the counter and connector line both rely on every child being a
  direct \`<li>\` in sequence.

**A11y** — Semantically just a numbered list (\`<ol>\`/\`<li>\`): screen readers
announce each step's position and total count for free, no extra ARIA
needed. The counter badge and connector line are pure CSS decoration with no
accessible-name impact — the step's accessible name comes entirely from
\`title\`/\`description\`/\`children\` text content.

**Relevant tokens** — \`--accent\` (counter number), \`--surface\` (counter
badge background), \`--border-strong\` (counter badge border + connector
line), \`--ink\` (title), \`--muted\` (description).
`

const meta = {
  title: "Navigation/SteppedList",
  component: SteppedList,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: { description: { component: USAGE } },
  },
} satisfies Meta<typeof SteppedList>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <SteppedList style={{ maxWidth: 420 }}>
      <SteppedListItem title="Create an account" description="Sign up with your email or connect an existing SSO provider." />
      <SteppedListItem title="Install the CLI" description="Run the one-line install script for your platform." />
      <SteppedListItem title="Ship your first component" description="Scaffold a component and open it in Storybook." />
    </SteppedList>
  ),
}

export const WithCustomContent: Story = {
  name: "With children (custom content)",
  render: () => (
    <SteppedList style={{ maxWidth: 420 }}>
      <SteppedListItem title="Install the package">
        <pre style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "8px 10px", fontSize: "0.85rem", overflowX: "auto" }}>
          npm install @hive/design-system
        </pre>
      </SteppedListItem>
      <SteppedListItem title="Import the base styles" description="Load tokens, reset, and fonts once at your app's root." />
    </SteppedList>
  ),
}

/**
 * `SteppedListItem` has no built-in `active`/`current` prop — emphasizing
 * one step is a consumer-side `className` choice, demonstrated here rather
 * than invented as a new component prop.
 */
export const CurrentStepEmphasized: Story = {
  name: "Current step emphasized (via className)",
  render: () => (
    <SteppedList style={{ maxWidth: 420 }}>
      <SteppedListItem title="Account created" description="Done — you're signed in." style={{ opacity: 0.6 }} />
      <SteppedListItem
        title="Verify your email"
        description="We just sent a confirmation link — this is where you are now."
        style={{ outline: "2px solid var(--focus)", outlineOffset: 4, borderRadius: "var(--rounded-sm)" }}
      />
      <SteppedListItem title="Invite your team" description="Add teammates once verification is complete." style={{ opacity: 0.6 }} />
    </SteppedList>
  ),
}
