import type { Meta, StoryObj } from "@storybook/react"

import { Checkbox } from "./Checkbox"

const meta = {
  title: "Forms/Checkbox",
  component: Checkbox,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
Radix-backed checkbox [R]. All a11y/keyboard behavior (Space to toggle,
\`role="checkbox"\`, \`aria-checked\`, non-focusable-when-disabled) is delegated
entirely to \`@radix-ui/react-checkbox\` — this wrapper only supplies
tokenized styling on top.

**When to use / when not**
- Use for a single independent on/off choice, or one item in a multi-select
  list (\`aria-checked\` supports \`"true"\`/\`"false"\`/\`"mixed"\` via
  \`checked="indeterminate"\`).
- Use \`checked="indeterminate"\` for a "select all" checkbox representing a
  partially-selected child set — it's a distinct third visual/ARIA state,
  not a style variant of checked.
- Don't use for a single yes/no setting that takes effect immediately (no
  form submit) — reach for \`Switch\` instead; that's the convention this DS
  draws between the two (Checkbox = form selection, Switch = live toggle).

**Do's & Don'ts**
- Do always pair with a visible \`<label>\`/\`Field\`, or at minimum
  \`aria-label\`, since the checkbox itself renders no text.
- Do drive \`checked\`/\`onCheckedChange\` for controlled usage (e.g. syncing
  "select all" with individual row checkboxes) — uncontrolled
  \`defaultChecked\` is fine for a single standalone checkbox.
- Don't expect Enter to toggle it — native checkbox semantics are Space-only;
  this is intentional and matches every native \`<input type="checkbox">\`.

**A11y**
- \`role="checkbox"\`, \`aria-checked\` (\`"true"\`/\`"false"\`/\`"mixed"\`), and
  keyboard toggling all come from Radix; disabled uses the real \`disabled\`
  attribute so it's automatically removed from the tab order.
- Focus ring is a themed \`outline\` on \`:focus-visible\` only (never on
  pointer click).

**Relevant tokens**: \`--surface\` (unchecked fill), \`--border-strong\`
(unchecked border), \`--accent\`/\`--accent-hover\` (checked/indeterminate
fill), \`--accent-ink\` (check glyph), \`--focus\` (focus ring), \`--faint\`
(disabled glyph), \`--surface-2\` (disabled fill).
        `,
      },
    },
  },
  args: {
    "aria-label": "Aceitar os termos",
  },
  argTypes: {
    checked: { control: "radio", options: [true, false, "indeterminate"] },
    disabled: { control: "boolean" },
  },
} satisfies Meta<typeof Checkbox>

export default meta

type Story = StoryObj<typeof meta>

export const Unchecked: Story = {
  args: {
    defaultChecked: false,
  },
}

export const Checked: Story = {
  args: {
    defaultChecked: true,
  },
}

export const Indeterminate: Story = {
  args: {
    checked: "indeterminate",
  },
}

export const Disabled: Story = {
  args: {
    disabled: true,
  },
}

export const DisabledChecked: Story = {
  args: {
    disabled: true,
    defaultChecked: true,
  },
}
