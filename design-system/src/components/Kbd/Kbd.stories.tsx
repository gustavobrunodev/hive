import type { Meta, StoryObj } from "@storybook/react"

import { Kbd } from "./Kbd"

/**
 * **Usage**
 *
 * - **When to use**: documenting a literal keyboard key or shortcut inline
 *   in text or a command palette hint (e.g. `Command`'s search demo).
 * - **When not**: don't use `Kbd` for a clickable button styled like a
 *   key — it's a semantic `<kbd>` for *documenting* input, not for
 *   *triggering* it.
 * - **Do**: render one `Kbd` per key and compose combinations yourself
 *   with a `+` separator (`<Kbd>Ctrl</Kbd>+<Kbd>K</Kbd>`) — `Kbd` only
 *   models a single key.
 * - **Don't**: put full words/sentences inside `Kbd` — reserve it for key
 *   names (`Ctrl`, `Enter`, `Esc`, `K`).
 * - **A11y**: `<kbd>` is the correct native element for "this represents
 *   keyboard input" and is already announced distinctly by most screen
 *   readers; no extra ARIA needed.
 * - **Tokens**: `--surface-2` (key cap bg), `--border` (key cap border),
 *   `--rounded-sm`, `--muted` (text), `--ff-num`.
 */
const meta = {
  title: "Data Display/Kbd",
  component: Kbd,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  args: {
    children: "Enter",
  },
} satisfies Meta<typeof Kbd>

export default meta

type Story = StoryObj<typeof meta>

export const SingleKey: Story = {
  args: { children: "Enter" },
}

export const Combination: Story = {
  name: "Key combination",
  render: () => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <Kbd>Ctrl</Kbd>
      <span aria-hidden="true">+</span>
      <Kbd>K</Kbd>
    </span>
  ),
}

export const ThreeKeyCombination: Story = {
  name: "Three-key combination",
  render: () => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <Kbd>Ctrl</Kbd>
      <span aria-hidden="true">+</span>
      <Kbd>Shift</Kbd>
      <span aria-hidden="true">+</span>
      <Kbd>P</Kbd>
    </span>
  ),
}
