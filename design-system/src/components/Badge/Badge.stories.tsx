import type { Meta, StoryObj } from "@storybook/react"

import { Badge } from "./Badge"

/**
 * **Usage**
 *
 * - **When to use**: a single short inline label riding alongside other
 *   content — a mode, status, or category tag (e.g. `CaseCard`'s `mode`
 *   prop renders a muted `Badge`). Not for a removable/interactive tag —
 *   use `Chip` for that vocabulary, or a real `Button` if it needs a click
 *   handler.
 * - **When not**: don't stack many `Badge`s to build a filter/selection
 *   UI — that's `Chip`'s job (`variant="tag"`/`"phase"`).
 * - **Do**: use `variant="accent"` (default) for the one label that should
 *   draw the eye; use `"muted"` for a secondary, informational label.
 * - **Don't**: put long text in a `Badge` — it's sized and padded for a
 *   single word or short phrase.
 * - **A11y**: purely presentational (`<span>`, no role/semantics beyond
 *   its text). If a `Badge` conveys status that isn't otherwise in the
 *   text (e.g. a color-only meaning), make sure the label text itself
 *   states it — don't rely on color alone.
 * - **Tokens**: `--accent` (accent variant), `--muted`/`--border` (muted
 *   variant).
 */
const meta = {
  title: "Data Display/Badge",
  component: Badge,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  args: {
    children: "Novo",
    variant: "accent",
  },
  argTypes: {
    variant: {
      control: "radio",
      options: ["accent", "muted"],
    },
  },
} satisfies Meta<typeof Badge>

export default meta

type Story = StoryObj<typeof meta>

export const Accent: Story = {
  args: {
    variant: "accent",
  },
}

export const Muted: Story = {
  args: {
    variant: "muted",
    children: "Beta",
  },
}

export const Overview: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 12 }}>
      <Badge variant="accent">Novo</Badge>
      <Badge variant="muted">Beta</Badge>
    </div>
  ),
}
