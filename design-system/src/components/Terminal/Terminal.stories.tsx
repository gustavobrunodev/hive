import type { Meta, StoryObj } from "@storybook/react"

import { Terminal } from "./Terminal"

/**
 * **Usage**
 *
 * - **When to use**: a decorative "terminal window" frame for showcasing a
 *   command + output + workflow phases — marketing/landing sections and
 *   docs illustrations, not a real interactive terminal emulator.
 * - **When not**: don't use `Terminal` where users need to actually type
 *   or interact — it renders static text and an animated caret, nothing is
 *   editable or focusable inside it.
 * - **Do**: pass `phases` (built from `Chip`, `variant="phase"`) to show
 *   workflow progress alongside a command; leave `output` unset for a
 *   plain command-only terminal.
 * - **Don't**: rely on the traffic-light dots to convey status (they're
 *   fixed decoration, not a live state indicator).
 * - **A11y**: the three title-bar dots and the blinking cursor are
 *   `aria-hidden` (cursor) or purely decorative (dots have no `aria-hidden`
 *   themselves but carry no text/meaning); the `phases` chip row is wrapped
 *   in `aria-hidden="true"` since it's illustrative, not primary content —
 *   don't rely on it to convey information a screen-reader user needs.
 *   The blinking cursor respects `prefers-reduced-motion` (animation is
 *   disabled, not just slowed).
 * - **Tokens & intentional raw values**: `--surface`/`--border`/
 *   `--border-strong` (frame), `--accent`/`--ink`/`--muted` (prompt/command/
 *   output text). The three title-bar dots are a deliberate exception to
 *   the DS's semantic-role convention: the first uses the raw brand primitive
 *   `--bordo-sensatez`, and the second/third use hard-coded hex shades
 *   (`#6e2230`, `#4d1822`) with **no token at all**. Per STATE.md's Layer-2
 *   token audit, this is intentional — no dark-theme semantic role resolves
 *   to these exact traffic-light shades, and introducing one purely for
 *   three decorative dots would either shift dark rendering or risk a
 *   light-theme contrast mismatch elsewhere. Treat this as a documented,
 *   accepted exception, not an inconsistency to fix.
 */
const meta = {
  title: "Data Display/Terminal",
  component: Terminal,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    title: "zsh — hive",
    command: "npm run build",
    cut: true,
  },
  argTypes: {
    cut: { control: "boolean" },
  },
} satisfies Meta<typeof Terminal>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    title: "zsh — hive",
    command: "npm run build",
  },
}

export const WithOutput: Story = {
  args: {
    title: "zsh — hive",
    command: "npm test",
    output: "12 suites passed · 0 failed · 1.4s",
  },
}

export const WithPhases: Story = {
  name: "With workflow phases",
  args: {
    title: "hive agent — deploy",
    command: "hive run deploy",
    output: "Building… this may take a moment.",
    phases: [
      { label: "Plan" },
      { label: "Build", active: true },
      { label: "Test" },
      { label: "Ship" },
    ],
  },
}

export const NoCut: Story = {
  args: {
    title: "zsh — hive",
    command: "npm run lint",
    cut: false,
  },
}
