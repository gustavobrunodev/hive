import type { Meta, StoryObj } from "@storybook/react"

import { Button } from "./Button"

const meta = {
  title: "Forms/Button",
  component: Button,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
Primary interactive trigger — solid \`primary\` for the single main action on a
screen, outlined \`ghost\` for secondary/cancel actions sitting alongside it.
Renders as a native \`<button type="button">\` by default, or as an \`<a>\` the
moment \`href\` is passed (never both — see A11y below).

**When to use / when not**
- Use for actions that submit, navigate, or trigger something immediately.
- Don't use for a small icon-only affordance or a toggle — this component has
  no icon-only or pressed/toggled visual state; reach for a dedicated
  control instead.
- Don't pass \`href\` and expect \`disabled\` to work — native anchors have no
  disabled state. A "disabled link" should instead be conditionally rendered
  without \`href\`, or routed to a page explaining why the action is
  unavailable.

**Do's & Don'ts**
- Do keep to one \`primary\` button per view/section; every sibling action
  should be \`ghost\`.
- Do use \`arrow\` only for actions that move the user forward (next step,
  external link) — it's purely decorative (\`aria-hidden\`) and carries no
  semantics of its own.
- Don't turn off \`cut\` (the clipped-corner \`cut-sm\` silhouette) selectively;
  it's a brand-wide silhouette, not a per-button style choice — only the
  Terminal/code-adjacent surfaces that shipped \`NoCut\` today are the
  intentional exception.

**A11y**
- Native \`<button>\`/\`<a>\` semantics come for free — no ARIA role needed.
- Focus ring is a tokenized \`box-shadow\` on \`:focus-visible\` (keyboard-only,
  never on mouse click).
- The trailing arrow glyph is \`aria-hidden\`; the button's accessible name
  comes entirely from \`children\`, so always pass real text (an icon-only
  button needs its own \`aria-label\`, which this component doesn't manage).

**Relevant tokens**: \`--accent\`, \`--accent-hover\` via literal hex overrides in
Button.css, \`--ink\`, \`--border-strong\`, \`--surface\`, \`--bg\` (focus-ring
inset), \`--ease-expo\`/\`--ease-quart\` (hover lift + arrow slide).
        `,
      },
    },
  },
  args: {
    children: "Começar agora",
    variant: "primary",
    arrow: false,
    cut: true,
  },
  argTypes: {
    variant: {
      control: "radio",
      options: ["primary", "ghost"],
    },
    arrow: { control: "boolean" },
    cut: { control: "boolean" },
    href: { control: "text" },
  },
} satisfies Meta<typeof Button>

export default meta

type Story = StoryObj<typeof meta>

export const Primary: Story = {
  args: {
    variant: "primary",
  },
}

export const Ghost: Story = {
  args: {
    variant: "ghost",
    children: "Ver documentação",
  },
}

export const WithArrow: Story = {
  args: {
    variant: "primary",
    arrow: true,
    children: "Conhecer a skill",
  },
}

export const Disabled: Story = {
  args: {
    variant: "primary",
    disabled: true,
    children: "Indisponível",
  },
}

export const NoCut: Story = {
  args: {
    variant: "ghost",
    cut: false,
    children: "Cancelar",
  },
}

export const AsLink: Story = {
  args: {
    variant: "primary",
    href: "https://hive.design",
    children: "Ir para a documentação",
  },
}

export const GhostDisabled: Story = {
  args: {
    variant: "ghost",
    disabled: true,
    children: "Indisponível",
  },
}
