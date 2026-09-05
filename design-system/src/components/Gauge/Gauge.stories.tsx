import type { Meta, StoryObj } from "@storybook/react"

import { Gauge } from "./Gauge"

const meta = {
  title: "Feedback/Gauge",
  component: Gauge,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
A radial meter for a quantity that is **draining**: a session, a quota, a
battery.

**When to use / when not:** use it when the reading is "how much is left" and
the user glances rather than studies — the ring answers before the number is
read. Use **Progress** for a task advancing towards completion (it has a
beginning and an end, and reads left to right). Use **LevelMeter** for a live
signal.

**Do's & Don'ts**
- Do let \`tone="auto"\` colour it: a countdown that stays accent at four
  minutes left is a picture that lies.
- Do pass \`valueText\` when the real reading is a duration — a screen reader
  saying "43 per cent" of a session is worse than "3 horas restantes".
- Don't use it for a value that only goes up.
`
      }
    }
  }
} satisfies Meta<typeof Gauge>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { value: 0.72, label: "Sessão AWS", caption: "restantes", children: "6 h" }
}

export const Warning: Story = {
  args: { value: 0.22, label: "Sessão AWS", caption: "restantes", children: "24 min" }
}

export const Expiring: Story = {
  args: { value: 0.04, label: "Sessão AWS", caption: "restantes", children: "3 min" }
}

export const Bare: Story = {
  args: { value: 0.6, label: "Uso", size: 44 }
}
