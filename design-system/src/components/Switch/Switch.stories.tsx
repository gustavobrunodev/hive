import type { Meta, StoryObj } from "@storybook/react"

import { Switch } from "./Switch"
import { Label } from "../Label/Label"

const meta = {
  title: "Forms/Switch",
  component: Switch,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
Accessible on/off toggle — wraps Radix's \`Switch.Root\`/\`Thumb\`. Delegates
the button role, checked state, and Space/Enter keyboard toggling to Radix;
this layer supplies tokenized styling only.

**When to use / when not**
- Use for a setting that takes effect immediately (no form submit needed) —
  e.g. "Dark mode", "Notifications". That's the line this DS draws between
  \`Switch\` and \`Checkbox\`: Switch = live setting, Checkbox = form selection
  applied on submit.
- Don't use inside a form that's submitted with a button — a \`Checkbox\` sets
  clearer expectations there ("this will apply when I submit").

**Do's & Don'ts**
- Do always pair with a visible, clickable label (the label text itself
  isn't part of this component — wire \`htmlFor\`/\`id\` yourself or use
  \`Field\`-style composition) so the hit target isn't just the small thumb.
- Do reflect the actual system state instantly on toggle — a \`Switch\` that
  waits for a save action to take effect breaks the "immediate" contract
  users read into this shape vs. a checkbox.
- Don't use \`Switch\` for a 3-state value — it's strictly binary
  (\`checked\`/unchecked, no indeterminate); use \`RadioGroup\` for anything
  with more than two states.

**A11y**
- Radix renders \`role="switch"\` with \`aria-checked\`; Space and Enter both
  toggle it (unlike \`Checkbox\`, which is Space-only — this matches native
  \`<button>\` semantics since a switch is fundamentally a button, not a
  checkbox input).
- Disabled uses Radix's \`data-disabled\` + a real \`disabled\` attribute,
  removing it from the tab order; visually it drops to 50% opacity rather
  than a separate disabled palette.

**Relevant tokens**: \`--surface-3\` (off track), \`--border\`/\`--border-strong\`
(off track ring), \`--accent\`/\`--accent-hover\` (on track), \`--ink\`
(off thumb), \`--accent-ink\` (on thumb), \`--focus\` (focus ring),
\`--shadow-1\` (thumb elevation).
        `,
      },
    },
  },
  args: {
    "aria-label": "Ativar notificações",
  },
  argTypes: {
    disabled: { control: "boolean" },
  },
} satisfies Meta<typeof Switch>

export default meta

type Story = StoryObj<typeof meta>

export const Off: Story = {
  args: {
    defaultChecked: false,
  },
}

export const On: Story = {
  args: {
    defaultChecked: true,
  },
}

export const Disabled: Story = {
  args: {
    disabled: true,
  },
}

export const DisabledOn: Story = {
  args: {
    disabled: true,
    defaultChecked: true,
  },
}

export const WithLabel: Story = {
  render: (args) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <Switch {...args} id="switch-notifications" aria-label={undefined} />
      <Label htmlFor="switch-notifications">Notificações por e-mail</Label>
    </div>
  ),
}
