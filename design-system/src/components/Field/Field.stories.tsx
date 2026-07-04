import type { Meta, StoryObj } from "@storybook/react"

import { Field } from "./Field"
import { Input } from "../Input/Input"
import { Textarea } from "../Textarea/Textarea"

const meta = {
  title: "Forms/Field",
  component: Field,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
Composes \`Label\` + a single form control + optional description/error text,
wiring the full accessible association (\`htmlFor\`/\`id\`/\`aria-describedby\`/
\`aria-invalid\`/\`aria-required\`) automatically. This is the primary way to
build a labeled form field in the DS — reach for \`Label\`+control directly
only when \`Field\`'s single-child-control shape doesn't fit (e.g. a
\`RadioGroup\` with multiple items).

**When to use / when not**
- Use for any single control (\`Input\`, \`Textarea\`, \`Select\` trigger, ...)
  that needs a label and, optionally, help or error text.
- Don't use for a group of controls (a \`RadioGroup\`'s several
  \`RadioGroupItem\`s, several checkboxes) — \`Field\` clones exactly one
  child element and will throw if given anything else.
- Don't render your own \`<label>\`/error \`<p>\` alongside a control that's
  already inside a \`Field\` — you'd get duplicate/conflicting
  \`aria-describedby\` wiring.

**Do's & Don'ts**
- Do pass \`error\` OR \`description\`, or both — both can coexist; when both
  are present the control's \`aria-describedby\` references both node ids.
- Do rely on \`Field\` to set \`aria-invalid\`/\`aria-required\` on the child —
  don't also set those directly on the wrapped control; \`Field\`'s
  \`cloneElement\` always wins since it's applied last.
- Don't wrap a control that doesn't accept \`id\`/\`aria-*\` props (e.g. a
  plain \`<div>\`) — \`Field\` expects a real form control element.

**A11y**
- Generates three internal ids (\`useId\`) and wires them together: the
  control's \`id\` (only if the child doesn't already have one), a
  description paragraph, and an error paragraph with \`role="alert"\` (error
  text is announced immediately when it appears, not just on next focus).
- \`required\` forwards to \`Label\` (visual + screen-reader "(required)") and
  to the control as \`aria-required\` — both channels always stay in sync
  since they come from the same prop.

**Relevant tokens**: \`--s-1\`/\`--s-2\` (internal spacing rhythm),
\`--danger-ink\` (error text), \`--muted\` (description text) — via
\`Label\`/\`Input\`/\`Textarea\`'s own token usage for the control itself.
        `,
      },
    },
  },
  args: {
    label: "E-mail",
    children: <Input placeholder="voce@empresa.com" />,
  },
} satisfies Meta<typeof Field>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => (
    <div style={{ width: 320 }}>
      <Field {...args}>
        <Input placeholder="voce@empresa.com" />
      </Field>
    </div>
  ),
}

export const WithDescription: Story = {
  args: {
    description: "Usaremos este e-mail apenas para notificações da conta.",
  },
  render: (args) => (
    <div style={{ width: 320 }}>
      <Field {...args}>
        <Input placeholder="voce@empresa.com" />
      </Field>
    </div>
  ),
}

export const WithError: Story = {
  args: {
    error: "Informe um e-mail válido.",
  },
  render: (args) => (
    <div style={{ width: 320 }}>
      <Field {...args}>
        <Input error defaultValue="não-é-um-email" />
      </Field>
    </div>
  ),
}

export const Required: Story = {
  args: {
    required: true,
    description: "Campo obrigatório para contato.",
  },
  render: (args) => (
    <div style={{ width: 320 }}>
      <Field {...args}>
        <Input placeholder="voce@empresa.com" />
      </Field>
    </div>
  ),
}

export const WithTextarea: Story = {
  args: {
    label: "Mensagem",
    description: "Descreva seu problema com o máximo de detalhes possível.",
  },
  render: (args) => (
    <div style={{ width: 360 }}>
      <Field {...args}>
        <Textarea placeholder="Escreva aqui..." minRows={3} />
      </Field>
    </div>
  ),
}
