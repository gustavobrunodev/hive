import type { Meta, StoryObj } from "@storybook/react"

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./Select"

const meta = {
  title: "Forms/Select",
  component: Select,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
Single-select dropdown — wraps Radix's \`Select.Root\`/\`Trigger\`/\`Portal\`/
\`Content\`/\`Viewport\`/\`Item\`. The closed-state \`SelectTrigger\` is styled
like \`Input\` (same height/border/radius/focus ring); the open listbox
(\`SelectContent\`) renders through a **React portal** onto \`document.body\`,
stacked at \`--z-dropdown\`, and picks up the ambient theme automatically
since \`data-theme\` lives on the real \`<html>\`, which the portal is still a
descendant of.

**When to use / when not**
- Use for choosing one value from a list too long, too dynamic, or too
  rarely-changed to justify showing every option at once (vs. \`RadioGroup\`,
  which shows all options up front — prefer that for ≤6 always-relevant
  choices).
- Don't reach for this when users need to type a query to filter a long
  list — that's \`Command\`'s job, not \`Select\`'s.

**Do's & Don'ts**
- Do always give \`SelectTrigger\` an accessible name (\`aria-label\` or a
  \`Field\`/\`Label\` pairing) — its only visible content is the current
  \`SelectValue\`/placeholder.
- Do use \`SelectGroup\`+\`SelectLabel\` to add a heading above a cluster of
  related \`SelectItem\`s, and \`SelectSeparator\` between clusters — don't
  fake either with plain disabled \`SelectItem\`s.
- Don't nest interactive elements inside \`SelectItem\` — Radix's roving
  focus model expects each item to be a single selectable unit.

**A11y — verify portal + operability**
- Renders \`role="combobox"\` on the trigger and \`role="listbox"\`/
  \`role="option"\` on the portalled content; Radix wires
  \`aria-expanded\`/\`aria-activedescendant\` and full arrow-key/Home/End/
  type-ahead navigation.
- \`avoidCollisions\` is on by default (Radix's own default, not overridden
  here) — the listbox repositions itself near a viewport edge rather than
  overflowing.
- Because \`SelectContent\` portals to \`document.body\`, verify in a real
  browser (not just visually in canvas) that opening it doesn't get clipped
  by an \`overflow: hidden\` ancestor of the trigger — portalling exists
  specifically to avoid that trap.

**Relevant tokens**: \`--surface\` (trigger + content bg), \`--border\`/
\`--border-strong\` (trigger), \`--focus\` (trigger focus/open ring),
\`--z-dropdown\` (content stacking), \`--rounded-sm\`/\`--rounded-md\`,
\`--shadow-2\` (content elevation), \`--surface-2\` (highlighted item),
\`--accent\` (selected-item check), \`--faint\` (disabled item/placeholder).
        `,
      },
    },
  },
  args: {
    defaultValue: "apple",
  },
} satisfies Meta<typeof Select>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => (
    <Select {...args}>
      <SelectTrigger aria-label="Fruta" style={{ width: 220 }}>
        <SelectValue placeholder="Escolha uma fruta" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="apple">Maçã</SelectItem>
        <SelectItem value="banana">Banana</SelectItem>
        <SelectItem value="cherry">Cereja</SelectItem>
        <SelectItem value="grape">Uva</SelectItem>
      </SelectContent>
    </Select>
  ),
}

export const Placeholder: Story = {
  args: {
    defaultValue: undefined,
  },
  render: (args) => (
    <Select {...args}>
      <SelectTrigger aria-label="Fruta" style={{ width: 220 }}>
        <SelectValue placeholder="Escolha uma fruta" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="apple">Maçã</SelectItem>
        <SelectItem value="banana">Banana</SelectItem>
      </SelectContent>
    </Select>
  ),
}

export const Disabled: Story = {
  args: {
    disabled: true,
    defaultValue: "apple",
  },
  render: (args) => (
    <Select {...args}>
      <SelectTrigger aria-label="Fruta" style={{ width: 220 }}>
        <SelectValue placeholder="Escolha uma fruta" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="apple">Maçã</SelectItem>
        <SelectItem value="banana">Banana</SelectItem>
      </SelectContent>
    </Select>
  ),
}

export const WithGroupsAndDisabledItem: Story = {
  name: "Groups, labels, separator, disabled item",
  render: (args) => (
    <Select {...args}>
      <SelectTrigger aria-label="Fruta" style={{ width: 240 }}>
        <SelectValue placeholder="Escolha uma fruta" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Cítricos</SelectLabel>
          <SelectItem value="orange">Laranja</SelectItem>
          <SelectItem value="lemon">Limão</SelectItem>
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>Frutas vermelhas</SelectLabel>
          <SelectItem value="cherry">Cereja</SelectItem>
          <SelectItem value="strawberry" disabled>
            Morango (fora de estação)
          </SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  ),
}

export const OpenForScreenshot: Story = {
  name: "Open (portal, for Playwright verification)",
  parameters: {
    docs: { disable: true },
  },
  render: (args) => (
    <Select {...args} defaultOpen>
      <SelectTrigger aria-label="Fruta" style={{ width: 220 }}>
        <SelectValue placeholder="Escolha uma fruta" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="apple">Maçã</SelectItem>
        <SelectItem value="banana">Banana</SelectItem>
        <SelectItem value="cherry">Cereja</SelectItem>
      </SelectContent>
    </Select>
  ),
}
