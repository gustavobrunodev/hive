import type { Meta, StoryObj } from "@storybook/react"

import { Progress } from "./Progress"

const meta = {
  title: "Feedback/Progress",
  component: Progress,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: `
A horizontal progress track wrapping Radix's \`Progress.Root\`/\`Indicator\`.

**When to use / when not:** use the determinate form when the underlying
operation reports real, meaningful percentage progress (a file upload, a
multi-step migration). Use the \`value={null}\` indeterminate form when work
is happening but there's no reliable fraction to report (an unknown-length
fetch) — don't fake a determinate bar that creeps up arbitrarily; that
mismatches user expectation once it stalls near 90%. For a small transient
"something is happening" indicator with no length concept at all, **Spinner**
is the better fit.

**Do's & Don'ts**
- Do pass \`max\` when the domain unit isn't naturally 0–100 (e.g. \`value={3} max={7}\` for "step 3 of 7") rather than pre-computing a percentage yourself.
- Do prefer the indeterminate state over a bar that jumps or stalls unpredictably — an honest "unknown duration" reads better than a dishonest percentage.
- Don't rely on color alone to communicate "done" — pair a completed bar with adjacent text/icon confirmation, since \`data-state="complete"\` isn't a distinct visual treatment here.

**Accessibility:** Radix wires \`role="progressbar"\` with
\`aria-valuenow\`/\`aria-valuemin\`/\`aria-valuemax\` automatically for the
determinate form, and omits \`aria-valuenow\` (announced as indeterminate) when
\`value={null}\`. The determinate fill transition and the indeterminate sweep
both honor \`prefers-reduced-motion: reduce\` (instant snap / static
half-opacity fill instead of animation).

**Tokens:** \`--surface-3\` for the track, \`--accent\` for the fill,
\`--rounded-full\` for the pill shape, \`--ease-quart\` for the fill transition.
        `,
      },
    },
  },
  args: {
    value: 62,
  },
  argTypes: {
    value: { control: { type: "range", min: 0, max: 100, step: 1 } },
  },
} satisfies Meta<typeof Progress>

export default meta

type Story = StoryObj<typeof meta>

/** A stable, seeded determinate value (not a live-incrementing demo) for a reproducible screenshot. */
export const Determinate: Story = {
  args: { value: 62 },
}

export const Empty: Story = {
  args: { value: 0 },
}

export const Complete: Story = {
  args: { value: 100 },
}

/** `value={null}` opts into the indeterminate sweep — no fixed-width fill, no `aria-valuenow`. */
export const Indeterminate: Story = {
  args: { value: null },
}
