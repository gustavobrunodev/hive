import type { Meta, StoryObj } from "@storybook/react"

import { Separator } from "./Separator"

const meta = {
  title: "Layout/Separator",
  component: Separator,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: `
A thin visual divider — wraps Radix's \`Separator.Root\` and supplies tokenized
styling only (a 1px line on \`--border\`); orientation, the decorative default,
and the a11y semantics are Radix's (see \`design.md\`'s D1, Radix → DS mapping).

**When to use / when not** — Use \`Separator\` to divide unrelated content
within the same container (a toolbar's icon groups, a settings list's
sections, a sidebar's rail from its footer). Don't use it to fake a border on
a single element — reach for the \`--border\` token directly on that element's
own \`border\` CSS property instead; \`Separator\` is for content that would
otherwise read as one undifferentiated block.

**Do's & Don'ts**
- Do set \`orientation="vertical"\` inside a flex row (e.g. between two toolbar
  button groups) — the component does not infer orientation from its parent's
  layout.
- Do leave \`decorative\` at its default (\`true\`) whenever the divider is
  purely visual — this keeps it out of the accessibility tree entirely (no
  \`role\`), which is correct for the vast majority of separators.
- Don't set \`decorative={false}\` unless the divider is genuinely conveying
  document structure to assistive tech (rare — most UI separators are purely
  visual chrome, not structural content).
- Don't rely on \`Separator\` for spacing — it renders a visible 1px line, not
  an invisible gap; use margin/gap utilities for pure whitespace.

**A11y** — Decorative by default: no \`role\`, entirely hidden from the
accessibility tree, matching how a sighted user perceives it (a rule, not a
landmark). Setting \`decorative={false}\` adds \`role="separator"\` plus the
matching \`aria-orientation\`. Note: the installed Radix primitive itself does
**not** default \`decorative\` to \`true\` — this DS's wrapper sets that default
explicitly (see \`STATE.md\` Lessons), so the safe-by-default behavior is a
property of this component, not an upstream guarantee.

**Relevant tokens** — \`--border\` (line color); no other role tokens apply.
`,
      },
    },
  },
  argTypes: {
    orientation: {
      control: "radio",
      options: ["horizontal", "vertical"],
    },
    decorative: {
      control: "boolean",
    },
  },
  args: {
    orientation: "horizontal",
    decorative: true,
  },
} satisfies Meta<typeof Separator>

export default meta

type Story = StoryObj<typeof meta>

export const Horizontal: Story = {
  render: (args) => (
    <div style={{ width: 320 }}>
      <p style={{ margin: 0 }}>Section one</p>
      <Separator {...args} style={{ margin: "12px 0" }} />
      <p style={{ margin: 0 }}>Section two</p>
    </div>
  ),
}

export const Vertical: Story = {
  args: {
    orientation: "vertical",
  },
  render: (args) => (
    <div style={{ display: "flex", alignItems: "center", height: 32, gap: 12 }}>
      <span>Item A</span>
      <Separator {...args} />
      <span>Item B</span>
      <Separator {...args} />
      <span>Item C</span>
    </div>
  ),
}

/** `decorative={false}` opts into `role="separator"` for a structurally meaningful divider. */
export const NonDecorative: Story = {
  args: {
    decorative: false,
  },
  render: (args) => (
    <div style={{ width: 320 }}>
      <p style={{ margin: 0 }}>Section one</p>
      <Separator {...args} style={{ margin: "12px 0" }} />
      <p style={{ margin: 0 }}>Section two</p>
    </div>
  ),
}
