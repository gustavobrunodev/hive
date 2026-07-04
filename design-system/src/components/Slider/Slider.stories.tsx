import type { Meta, StoryObj } from "@storybook/react"

import { Slider } from "./Slider"

const meta = {
  title: "Forms/Slider",
  component: Slider,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
Wraps Radix's \`Slider.Root\`/\`Track\`/\`Range\`/\`Thumb\` with DS tokens.
Transparently supports both a single value and a **range** (two-or-more
thumbs): the number of thumbs rendered is derived from the length of the
\`value\`/\`defaultValue\` array, matching how Radix itself determines thumb
count — there is no separate "range" prop or variant to opt into.

**When to use / when not**
- Use for selecting one numeric value, or a bounded range of two numeric
  values (e.g. a price range), on a continuous or stepped scale.
- Don't use for a small, fixed set of discrete choices — a \`RadioGroup\` or
  \`Select\` communicates a closed option set far more clearly than dragging a
  thumb to one of a few snap points.
- Prefer pairing with a visible numeric readout (a live text label showing
  the current value) — a bare slider with no numeric feedback forces users
  to guess at precision.

**Do's & Don'ts**
- Do pass \`min\`/\`max\`/\`step\` explicitly rather than relying on Radix's
  bare defaults (\`0\`/\`100\`/\`1\`) whenever the domain isn't literally 0-100.
- Do drive it as controlled (\`value\`+\`onValueChange\`) whenever another part
  of the UI needs to reflect or set the same value (e.g. a paired number
  \`Input\`) — uncontrolled \`defaultValue\` is fine for a fire-and-forget
  setting.
- Don't pass a \`value\` array with more than 2-3 entries expecting a
  meaningful visual result — every additional entry adds one more thumb on
  the same track, which becomes hard to grab/read past a couple of thumbs.

**A11y**
- Each thumb gets \`role="slider"\` with \`aria-valuenow\`/\`aria-valuemin\`/
  \`aria-valuemax\` from Radix; Arrow keys (and Home/End/Page Up/Down)
  move the focused thumb by \`step\`.
- Give each thumb a name via \`aria-label\` (or \`aria-labelledby\`) — for a
  range slider, label the *low* and *high* thumbs distinctly (e.g. "Preço
  mínimo"/"Preço máximo") since there's no built-in per-thumb text.
- Disabled uses \`data-disabled\` + Radix's own disabled handling, removing
  thumbs from the tab order.

**Relevant tokens**: \`--border\` (track), \`--accent\`/\`--accent-hover\`
(filled range + thumb), \`--surface\` (thumb border, "cutout" ring look),
\`--focus\`+\`--bg\` (double-ring focus indicator), \`--faint\`/\`--surface-3\`
(disabled track/range).
        `,
      },
    },
  },
  args: {
    min: 0,
    max: 100,
    step: 1,
    defaultValue: [50],
  },
  argTypes: {
    min: { control: "number" },
    max: { control: "number" },
    step: { control: "number" },
    disabled: { control: "boolean" },
    orientation: { control: "radio", options: ["horizontal", "vertical"] },
  },
} satisfies Meta<typeof Slider>

export default meta

type Story = StoryObj<typeof meta>

export const SingleValue: Story = {
  args: {
    "aria-label": "Volume",
    defaultValue: [50],
  },
  render: (args) => (
    <div style={{ width: 280 }}>
      <Slider {...args} />
    </div>
  ),
}

export const Range: Story = {
  args: {
    defaultValue: [20, 80],
  },
  render: (args) => (
    <div style={{ width: 280 }}>
      <Slider {...args} aria-label={undefined} />
    </div>
  ),
}

export const Stepped: Story = {
  name: "Stepped (step=10)",
  args: {
    "aria-label": "Nível",
    step: 10,
    defaultValue: [30],
  },
  render: (args) => (
    <div style={{ width: 280 }}>
      <Slider {...args} />
    </div>
  ),
}

export const Disabled: Story = {
  args: {
    "aria-label": "Volume",
    defaultValue: [50],
    disabled: true,
  },
  render: (args) => (
    <div style={{ width: 280 }}>
      <Slider {...args} />
    </div>
  ),
}

export const Vertical: Story = {
  args: {
    "aria-label": "Volume",
    orientation: "vertical",
    defaultValue: [40],
  },
  render: (args) => (
    <div style={{ height: 160 }}>
      <Slider {...args} />
    </div>
  ),
}
