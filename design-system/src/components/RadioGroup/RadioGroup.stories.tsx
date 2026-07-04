import type { Meta, StoryObj } from "@storybook/react"

import { RadioGroup, RadioGroupItem } from "./RadioGroup"
import { Label } from "../Label/Label"

const meta = {
  title: "Forms/RadioGroup",
  component: RadioGroup,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
Accessible radio group — wraps Radix's \`RadioGroup.Root\`/\`Item\`/\`Indicator\`.
Roving-tabindex, arrow-key navigation, and ARIA are entirely delegated to
Radix; this layer supplies tokenized styling only.

**When to use / when not**
- Use for a single choice among 2-6 mutually-exclusive, always-visible
  options. Above that, or when options need search, prefer \`Select\` instead
  — a radio group that scrolls off-screen defeats the point of showing every
  option at once.
- Don't use a single \`Checkbox\` to fake a 2-option radio choice — a real
  \`RadioGroup\` with two \`RadioGroupItem\`s gets you the roving-tabindex/
  arrow-key model users expect from \`role="radiogroup"\`.

**Do's & Don'ts**
- Do give the \`RadioGroup\` itself an accessible name (\`aria-label\` or
  \`aria-labelledby\`) — individual items only need a name if they aren't
  paired with a visible \`<label htmlFor>\`.
- Do set \`orientation="horizontal"\` (defaults to Radix's \`"vertical"\`) only
  when the options are genuinely a short, scannable row — vertical stacking
  reads better for anything with longer labels.
- Don't disable individual \`RadioGroupItem\`s without also disabling
  \`RadioGroup\` when *no* option should be selectable — a group with some
  items enabled communicates that a choice is still expected.

**A11y — real keyboard model**
- Radix gives \`role="radiogroup"\` on the root and \`role="radio"\` +
  roving \`tabIndex\` on items — the whole group is one Tab stop; Arrow
  keys move focus *and* auto-select the newly-focused item (native radio
  behavior, not opt-in).
- That auto-select fires on a deferred (\`setTimeout(0)\`) focus-move after a
  raw \`keydown\`, cleared on \`keyup\` — so if you're ever scripting this
  interaction (tests, automation) a fast synthetic
  keydown+keyup pair can outrun it; hold the key down across the event
  instead of firing a single instantaneous keypress.
- \`Space\` re-selects the focused item; it never moves focus.

**Relevant tokens**: \`--surface\` (unselected fill), \`--border-strong\`
(unselected ring), \`--accent\`/\`--accent-hover\` (selected ring + dot),
\`--focus\` (focus ring), \`--faint\` (disabled dot), \`--surface-2\` (disabled
fill), \`--s-3\`/\`--s-4\` (item gap, vertical/horizontal).
        `,
      },
    },
  },
  args: {
    "aria-label": "Plano",
    defaultValue: "free",
  },
  argTypes: {
    orientation: { control: "radio", options: ["vertical", "horizontal"] },
    disabled: { control: "boolean" },
  },
} satisfies Meta<typeof RadioGroup>

export default meta

type Story = StoryObj<typeof meta>

function OptionRow({ id, value, label }: { id: string; value: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <RadioGroupItem value={value} id={id} />
      <Label htmlFor={id}>{label}</Label>
    </div>
  )
}

export const Vertical: Story = {
  render: (args) => (
    <RadioGroup {...args}>
      <OptionRow id="rg-free" value="free" label="Gratuito" />
      <OptionRow id="rg-pro" value="pro" label="Pro" />
      <OptionRow id="rg-enterprise" value="enterprise" label="Enterprise" />
    </RadioGroup>
  ),
}

export const Horizontal: Story = {
  args: {
    orientation: "horizontal",
  },
  render: (args) => (
    <RadioGroup {...args}>
      <OptionRow id="rg-h-free" value="free" label="Gratuito" />
      <OptionRow id="rg-h-pro" value="pro" label="Pro" />
      <OptionRow id="rg-h-enterprise" value="enterprise" label="Enterprise" />
    </RadioGroup>
  ),
}

export const WithDisabledItem: Story = {
  render: (args) => (
    <RadioGroup {...args}>
      <OptionRow id="rg-d-free" value="free" label="Gratuito" />
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <RadioGroupItem value="pro" id="rg-d-pro" disabled />
        <Label htmlFor="rg-d-pro">Pro (indisponível)</Label>
      </div>
      <OptionRow id="rg-d-enterprise" value="enterprise" label="Enterprise" />
    </RadioGroup>
  ),
}

export const GroupDisabled: Story = {
  args: {
    disabled: true,
  },
  render: (args) => (
    <RadioGroup {...args}>
      <OptionRow id="rg-gd-free" value="free" label="Gratuito" />
      <OptionRow id="rg-gd-pro" value="pro" label="Pro" />
    </RadioGroup>
  ),
}
