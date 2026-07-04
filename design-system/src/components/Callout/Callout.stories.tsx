import type { Meta, StoryObj } from "@storybook/react"

import { Callout } from "./Callout"

const meta = {
  title: "Feedback/Callout",
  component: Callout,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: `
A brand-register callout for spec/docs-style marketing copy — not part of
the product register's semantic info/success/warning/danger vocabulary.

**When to use / when not:** use \`variant="gate"\` for a "this section marks a
checkpoint" note (a spec gate, a milestone marker) on brand-register pages
(docs, landing sections). Use \`variant="limits"\` for scoping/caveat copy
next to that content. Don't reach for Callout on product-register app
screens (chat, file explorer, settings) — its dashed border and
brand-tinted background are deliberately part of the marketing site's visual
language; use **Alert** there instead for the same semantic-tone need.

**Do's & Don'ts**
- Do keep \`label\`/\`icon\` short — both render as compact leading markers, not headings.
- Do use \`cut\` only on the \`"limits"\` variant when the surrounding layout already uses the brand's cut-corner motif elsewhere on the page, for visual consistency; it has no effect on \`"gate"\`.
- Don't use Callout for transient action feedback (a save confirmation) — it has no dismiss affordance and isn't wired to any live region; that's Toast's job.

**Accessibility:** renders as plain static content with no special role,
appropriate for content that's part of the page at first render (the same
reasoning Alert's default no-\`role\` stance uses). The \`icon\` glyph on the
\`"limits"\` variant is \`aria-hidden\` since the surrounding text already
carries the meaning.

**Tokens:** \`--bg\`/\`--border\`/\`--ink\`/\`--success\` for the \`"gate"\` variant's
dashed marker box; the \`"limits"\` variant currently uses a few literal
brand-adjacent values (not yet threaded through semantic role tokens — see
Known issues) alongside \`--border\`.
        `,
      },
    },
  },
  args: {
    variant: "limits",
    children: "This component covers the common cases; edge cases are documented separately.",
  },
  argTypes: {
    variant: {
      control: "radio",
      options: ["gate", "limits"],
    },
  },
} satisfies Meta<typeof Callout>

export default meta

type Story = StoryObj<typeof meta>

export const Limits: Story = {
  args: {
    variant: "limits",
    icon: "!",
    children: "This component covers the common cases; edge cases are documented separately.",
  },
}

export const LimitsCut: Story = {
  args: {
    variant: "limits",
    icon: "!",
    cut: true,
    children: "Same note, with the brand's cut-corner silhouette applied.",
  },
}

export const Gate: Story = {
  args: {
    variant: "gate",
    label: "Gate",
    children: "All tasks in this phase must pass before moving on.",
  },
}

export const GateCustomLabel: Story = {
  args: {
    variant: "gate",
    label: "Blocked",
    children: "Waiting on the upstream API contract before this can proceed.",
  },
}

/** Both variants side by side. */
export const AllVariants: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Callout variant="gate" label="Gate">
        All tasks in this phase must pass before moving on.
      </Callout>
      <Callout variant="limits" icon="!">
        This component covers the common cases; edge cases are documented separately.
      </Callout>
    </div>
  ),
}
