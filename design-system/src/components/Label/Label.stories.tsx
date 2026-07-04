import type { Meta, StoryObj } from "@storybook/react"

import { Label } from "./Label"
import { Input } from "../Input/Input"

const meta = {
  title: "Forms/Label",
  component: Label,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
Thin, styleable wrapper over the native \`<label>\`. Pairs with a form control
via \`htmlFor\`/\`id\`. Most consumers won't reach for this directly — \`Field\`
already composes it with the full label/description/error wiring — but it's
exported standalone for one-off cases (e.g. labeling a group of controls that
isn't a single \`Field\`).

**When to use / when not**
- Use directly when you need a label without \`Field\`'s description/error
  slots (e.g. labeling a \`RadioGroup\` or a custom composite control).
- Prefer \`Field\` when the label belongs to exactly one input and you also
  need description/error text — it handles the \`htmlFor\`/\`id\`/
  \`aria-describedby\` association automatically; wiring it by hand here
  requires manually matching \`htmlFor\` to the control's \`id\`.

**Do's & Don'ts**
- Do always pass \`htmlFor\` pointing at the control's \`id\` when used
  standalone — this component does not generate or forward an \`id\` for you
  (that's \`Field\`'s job).
- Do use \`required\` rather than appending a literal \`*\` to the label text —
  it renders both the visual asterisk and a screen-reader-only "(required)"
  suffix together, so the two can't drift out of sync.
- Don't use \`required\` as the *only* signal that a field must be filled —
  also set \`aria-required\`/\`required\` on the control itself (\`Field\` does
  this for you).

**A11y**
- Renders a real \`<label>\` — clicking it focuses/activates the associated
  control natively, no JS needed, as long as \`htmlFor\`/\`id\` match.
- The required asterisk is \`aria-hidden\`; a \`VisuallyHidden\` "(required)"
  text carries the same information to screen readers, so sighted and
  non-sighted users get equivalent information from different channels.

**Relevant tokens**: \`--ink\` (label text), \`--danger-ink\` (required
asterisk), \`--ff-body\`.
        `,
      },
    },
  },
  args: {
    children: "Endereço de e-mail",
    required: false,
  },
  argTypes: {
    required: { control: "boolean" },
  },
} satisfies Meta<typeof Label>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <Label {...args} htmlFor="label-demo-input" />
      <Input id="label-demo-input" placeholder="voce@empresa.com" />
    </div>
  ),
}

export const Required: Story = {
  args: {
    required: true,
  },
  render: (args) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <Label {...args} htmlFor="label-demo-required" />
      <Input id="label-demo-required" placeholder="voce@empresa.com" required />
    </div>
  ),
}
