import type { Meta, StoryObj } from "@storybook/react"

import { RingMeter } from "./RingMeter"

const meta = {
  title: "Feedback/RingMeter",
  component: RingMeter,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
A radial meter for something **filling up**: a context window, a disk, a
budget.

**When to use / when not:** three meters, three questions.
**Progress** — "how far along is this task?" (a journey, read left to right).
**Gauge** — "how much is left of something draining?" (turns red near *zero*).
**RingMeter** — "how full is this container?" (turns red near the *top*).
Picking the wrong one inverts every threshold the caller writes.

**Do's & Don'ts**
- Do use \`segments\` when the fill has provenance — one quantity from several
  sources. Give them one hue at descending emphasis, not four colours: four
  colours read as good/warn/bad, which is a different claim.
- Do keep it legible when small: at 16px drop the face and put the number
  beside the ring, not inside it.
- Do pass \`indeterminate\` instead of unmounting when nothing has been measured
  yet. A gauge that removes itself teaches nobody that it exists.
- Don't use it for a value that only goes down.
`
      }
    }
  }
} satisfies Meta<typeof RingMeter>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { value: 0.34, label: "Janela de contexto", size: 92, caption: "cheio", children: "34%" }
}

export const NearTheCeiling: Story = {
  args: { value: 0.93, label: "Janela de contexto", size: 92, caption: "cheio", children: "93%" }
}

/** One quantity, three provenances — the reading the context window actually has. */
export const Segmented: Story = {
  args: {
    label: "Janela de contexto",
    size: 116,
    caption: "de 200 k",
    children: "41%",
    segments: [
      { id: "cacheRead", value: 0.26, color: "color-mix(in oklab, var(--accent) 34%, var(--surface-3))" },
      { id: "cacheCreation", value: 0.09, color: "color-mix(in oklab, var(--accent) 62%, var(--surface-3))" },
      { id: "input", value: 0.06, color: "var(--accent)" }
    ]
  }
}

/** The built-in ramp, for a host with no colour vocabulary of its own. */
export const SegmentedDefaultRamp: Story = {
  args: {
    label: "Disco",
    size: 92,
    children: "72%",
    segments: [
      { id: "a", value: 0.4 },
      { id: "b", value: 0.2 },
      { id: "c", value: 0.12 }
    ]
  }
}

/** Composer-footer size: the ring is the glyph, the number lives beside it. */
export const Inline: Story = {
  args: { value: 0.62, label: "Janela de contexto", size: 16 },
  render: () => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12 }}>
      <RingMeter value={0.62} label="Janela de contexto" size={16} />
      <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 620 }}>62%</span>
      <span style={{ color: "var(--muted)" }}>de contexto</span>
    </span>
  )
}

export const Indeterminate: Story = {
  args: { value: 0, label: "Janela de contexto", size: 92, indeterminate: true, children: "—" }
}
