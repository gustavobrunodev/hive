import type { Meta, StoryObj } from "@storybook/react"

import { Input } from "./Input"

const meta = {
  title: "Forms/Input",
  component: Input,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
Product-register single-line text field. Visually matches \`Select\`'s trigger
(same height/border/radius/focus ring) so the two read as one control family
when mixed in a form.

**When to use / when not**
- Use for any free-text/number/email/etc. single-line value. For multi-line
  content reach for \`Textarea\` instead — this component doesn't autosize or
  wrap.
- Prefer composing it inside \`Field\` rather than hand-rolling a label +
  error message; \`Field\` wires \`aria-describedby\`/\`aria-invalid\`/
  \`aria-required\` for you.

**Do's & Don'ts**
- Do pass \`error\` (not a red border via \`className\`) to mark a field
  invalid — it drives both the danger-tinted visual state and
  \`aria-invalid="true"\` together, so the two states can never drift out of
  sync.
- Do use \`startIcon\` for a leading glyph (search, currency, etc.); it's
  purely presentational (\`aria-hidden\`) and shifts the input's padding
  automatically — don't also pass manual left padding via \`className\`.
- Don't rely on \`disabled\` alone to communicate "field currently
  unavailable, will be enabled later" — pair it with copy explaining why, since
  disabled controls are already easy to overlook.

**A11y**
- Renders a real \`<input>\`; all native attributes (\`type\`, \`required\`,
  \`aria-label\`, \`name\`, ...) pass straight through via \`...rest\`.
- \`error\` sets \`aria-invalid="true"\`, but does **not** by itself associate an
  error message — pair with \`Field\`'s \`error\` prop (or your own
  \`aria-describedby\`) so screen readers announce *why* it's invalid, not
  just *that* it is.
- Focus is the browser's native \`:focus-visible\` (keyboard-only), styled
  with a themed ring — never suppressed.

**Relevant tokens**: \`--surface\`, \`--border\`/\`--border-strong\` (hover),
\`--focus\` (focus ring), \`--danger\` (error border/ring), \`--ink\`, \`--faint\`
(placeholder + disabled text), \`--surface-2\` (disabled fill), \`--muted\`
(icon slot).
        `,
      },
    },
  },
  args: {
    placeholder: "voce@empresa.com",
  },
  argTypes: {
    error: { control: "boolean" },
    disabled: { control: "boolean" },
    startIcon: { control: false },
  },
} satisfies Meta<typeof Input>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
}

export const Focused: Story = {
  name: "Focus (autofocus for screenshot)",
  args: {
    autoFocus: true,
    defaultValue: "contato@gustavobruno.dev",
  },
}

export const WithError: Story = {
  args: {
    error: true,
    defaultValue: "não-é-um-email",
  },
}

export const Disabled: Story = {
  args: {
    disabled: true,
    defaultValue: "Indisponível",
  },
}

export const WithStartIcon: Story = {
  args: {
    startIcon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    placeholder: "Buscar...",
  },
}
