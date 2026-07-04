import type { Meta, StoryObj } from "@storybook/react"

import { Panel } from "./Panel"

const meta = {
  title: "Layout/Panel",
  component: Panel,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: `
A tokenized surface wrapper — a bordered \`--surface\` block with the brand's
diagonal cut-corner motif (\`.cut\`) on by default, plus opt-in hover
transitions and an accent border variant.

**When to use / when not** — Use \`Panel\` for brand-register surfaces: a
marketing feature tile, a pricing card, a value proposition block — anywhere
the diagonal-cut signature is appropriate. Don't use it as generic dense
product-UI chrome (a settings row, a table cell, a chat message bubble) —
PRODUCT.md is explicit that the cut-corner motif "stays a brand-register
signature... and does not migrate onto dense UI chrome"; set \`cut={false}\`
if you need a plain bordered surface in a product context, or prefer a
plainer container entirely.

**Do's & Don'ts**
- Do set \`hover="lift"\` or \`hover="slide"\` only on panels that are
  themselves a clickable/navigable unit — the transition implies
  interactivity, so a purely static panel should stay \`hover="none"\`.
- Do use \`accentBorder\` sparingly, as a one-off highlight (e.g. a featured
  pricing tier) — not as a default state for every panel in a grid.
- Don't nest a \`Panel\` inside another \`Panel\` — nested cards are a layout
  smell; use a plain \`div\` with spacing for internal grouping instead.
- Don't rely on \`as\` to turn \`Panel\` into a button — it changes the
  rendered tag for semantics (e.g. \`"article"\`, \`"section"\`), not
  interaction; wire click handlers/keyboard support yourself if the panel is
  genuinely a trigger.

**A11y** — \`Panel\` renders no implicit role or interactive semantics — it's
a styled container. When \`hover\` implies the whole panel is a link/button,
make sure the actual interactive element (an \`<a>\`/\`<button>\`, or the \`as\`
prop) carries that role and is keyboard-focusable; the hover transition
alone does not add any.

**Relevant tokens** — \`--surface\` (background), \`--border\`/\`--border-strong\`
(default vs. hover border), \`--ease-expo\` (hover transition curve); the
accent border uses a fixed brand rgba rather than a role token (a deliberate
raw-value exception — see \`STATE.md\`'s Lessons on non-role-mapped brand
primitives).
`,
      },
    },
  },
  argTypes: {
    hover: {
      control: "radio",
      options: ["none", "lift", "slide"],
    },
    cut: { control: "boolean" },
    accentBorder: { control: "boolean" },
  },
  args: {
    cut: true,
    hover: "none",
    accentBorder: false,
    children: "Panel content",
  },
  render: (args) => (
    <Panel {...args} style={{ padding: 24, width: 280 }}>
      {args.children}
    </Panel>
  ),
} satisfies Meta<typeof Panel>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const NoCut: Story = {
  args: {
    cut: false,
    children: "No cut corner — a plain bordered surface.",
  },
}

export const HoverLift: Story = {
  args: {
    hover: "lift",
    children: "Hover to lift — implies a clickable/navigable panel.",
  },
}

export const HoverSlide: Story = {
  args: {
    hover: "slide",
    children: "Hover to slide sideways.",
  },
}

export const AccentBorder: Story = {
  args: {
    accentBorder: true,
    children: "A featured panel with an accent border.",
  },
}

export const AsArticle: Story = {
  args: {
    as: "article",
    children: "Rendered as an <article> element.",
  },
}

/** Side-by-side overview of every variant. */
export const AllVariants: Story = {
  render: () => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
      <Panel style={{ padding: 24, width: 200 }}>Default (cut)</Panel>
      <Panel cut={false} style={{ padding: 24, width: 200 }}>
        No cut
      </Panel>
      <Panel hover="lift" style={{ padding: 24, width: 200 }}>
        Hover lift
      </Panel>
      <Panel hover="slide" style={{ padding: 24, width: 200 }}>
        Hover slide
      </Panel>
      <Panel accentBorder style={{ padding: 24, width: 200 }}>
        Accent border
      </Panel>
    </div>
  ),
}
