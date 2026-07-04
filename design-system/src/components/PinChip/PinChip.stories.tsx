import type { Meta, StoryObj } from "@storybook/react"

import { PinChip } from "./PinChip"

/**
 * **Usage**
 *
 * - **When to use**: pinning a name to a drive/delegate role — its main
 *   consumer is `SkillSpinePin`, which renders a `drive` and `delegate`
 *   list of names as rows of `PinChip`s.
 * - **When not**: for a generic tag/label with no drive-vs-delegate
 *   meaning, use `Chip` or `Badge` instead.
 * - **Do**: use `variant="drive"` (default) for the owner/driver of a
 *   skill or responsibility, `"deleg"` for who it's delegated to.
 * - **Don't**: use `PinChip` outside a drive/delegate pairing context —
 *   its two variants only make sense relative to each other.
 * - **A11y**: presentational `<span>`; when used in `SkillSpinePin`'s
 *   rows, the preceding `.hds-pin-lbl` text (e.g. "Conduz"/"Delega")
 *   carries the drive/delegate meaning for screen readers, not the chip's
 *   styling alone.
 * - **Tokens**: `--bordo-sensatez`/`--cinza-impacto` (drive), `--muted`/
 *   `--border-strong` (deleg), `--ff-num`.
 */
const meta = {
  title: "Data Display/PinChip",
  component: PinChip,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  args: {
    children: "Ana",
    variant: "drive",
  },
  argTypes: {
    variant: {
      control: "radio",
      options: ["drive", "deleg"],
    },
  },
} satisfies Meta<typeof PinChip>

export default meta

type Story = StoryObj<typeof meta>

export const Drive: Story = {
  args: { variant: "drive", children: "Ana" },
}

export const Delegate: Story = {
  args: { variant: "deleg", children: "Bruno" },
}

export const Overview: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 8 }}>
      <PinChip variant="drive">Ana</PinChip>
      <PinChip variant="deleg">Bruno</PinChip>
    </div>
  ),
}
