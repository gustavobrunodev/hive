import type { Meta, StoryObj } from "@storybook/react"

import { Spinner } from "./Spinner"

const meta = {
  title: "Feedback/Spinner",
  component: Spinner,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
A small rotating-arc indicator for an inline or blocking pending action
(a submitting Button's loading state, a small panel fetching data).

**When to use / when not:** use Spinner for "something is happening right
now" at a fixed, small footprint. For content that will appear in place once
loaded (a card, a table row, a chat message), use **Skeleton** instead — it
holds the eventual layout so nothing reflows when the content arrives.

**Do's & Don'ts**
- Do pass a specific \`label\` when the surrounding UI doesn't already say what's loading (e.g. \`"Saving"\` vs the generic default \`"Loading"\`) — it's the only thing screen-reader users hear.
- Do use the named sizes (\`sm\`/\`md\`/\`lg\`) for consistency with the rest of the system; drop to a raw pixel number only for a genuinely one-off fit.
- Don't pair a Spinner with a redundant visible "Loading..." text label right next to it — the accessible name is already carried via \`VisuallyHidden\`.

**Accessibility:** renders \`role="status"\` with the \`label\` in a visually
hidden node, so it's announced without adding visible clutter. Honors
\`prefers-reduced-motion: reduce\` by freezing the arc into a static partial
ring (mirrored via \`data-reduced-motion\` so it's testable and applies from
first paint) rather than removing the pending signal outright.

**Tokens:** \`--accent\` for the arc (overridable per-instance via the
\`--hds-spinner-color\` custom property), \`--border-strong\` for the static track.
        `,
      },
    },
  },
  args: {
    size: "md",
    label: "Loading",
  },
  argTypes: {
    size: {
      control: "radio",
      options: ["sm", "md", "lg"],
    },
  },
} satisfies Meta<typeof Spinner>

export default meta

type Story = StoryObj<typeof meta>

export const Small: Story = {
  args: { size: "sm" },
}

export const Medium: Story = {
  args: { size: "md" },
}

export const Large: Story = {
  args: { size: "lg" },
}

/** All named sizes rendered together for a quick side-by-side scale check. */
export const AllSizes: Story = {
  render: () => (
    <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
      <Spinner size="sm" label="Loading small" />
      <Spinner size="md" label="Loading medium" />
      <Spinner size="lg" label="Loading large" />
    </div>
  ),
}

/** Overriding the arc color via `--hds-spinner-color` for a danger-tinted context. */
export const CustomColor: Story = {
  args: {
    size: "lg",
    style: { ["--hds-spinner-color" as string]: "var(--danger)" },
  },
}
