import type { Meta, StoryObj } from "@storybook/react"

import { BrandMark } from "./BrandMark"

const meta = {
  title: "Brand/BrandMark",
  component: BrandMark,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
A compact single-letter monogram chip — a fixed 38×38px tile with a cut
top-right/bottom-left corner, built for tight spaces where the full
\`Logo\` would be too heavy (e.g. next to a wordmark inside \`Footer\`).

**When to use / when not** — Reach for \`BrandMark\` as a small brand
anchor alongside other content (a wordmark, a nav item, a footer brand
row). Don't use it as a substitute for \`Logo\` in primary brand contexts
(marketing hero, top-level nav) — it carries no legible "Hive" wordmark
of its own, only a single initial.

**Do's & Don'ts** — Do keep the default \`letter="Z"\` unless you're
deliberately representing a different initial. Don't resize it with
\`font-size\`; the tile is a fixed-size square with a hand-tuned
\`clip-path\` cut, so scale the whole element (e.g. CSS \`transform:
scale()\`) if a different size is needed. Don't drop it on a surface
lighter than \`--bordo-sensatez\` without checking contrast — the letter
color is fixed to \`--cinza-impacto\`, tuned for the brand's darker tones.

**Accessibility** — The letter is real text content, not an icon, so
it's already announced by screen readers without extra markup. If it's
placed purely decoratively next to an already-visible wordmark, consider
\`aria-hidden="true"\` on the wrapper to avoid a duplicate announcement.

**Relevant tokens** — \`--bordo-sensatez\` (tile background), \`--cinza-impacto\`
(letter color), \`--ff-display\` (font family).
        `,
      },
    },
  },
  argTypes: {
    letter: { control: "text" },
  },
} satisfies Meta<typeof BrandMark>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
}

export const CustomLetter: Story = {
  args: {
    letter: "H",
  },
}

export const LetterOverview: Story = {
  name: "Letter overview",
  parameters: {
    docs: {
      description: {
        story: "The mark scales to whatever single letter is passed — a side-by-side look at a few initials.",
      },
    },
  },
  render: () => (
    <div style={{ display: "flex", gap: 16 }}>
      <BrandMark letter="Z" />
      <BrandMark letter="H" />
      <BrandMark letter="A" />
      <BrandMark letter="9" />
    </div>
  ),
}
