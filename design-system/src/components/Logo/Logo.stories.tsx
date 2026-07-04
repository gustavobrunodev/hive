import type { Meta, StoryObj } from "@storybook/react"

import { Logo } from "./Logo"

const meta = {
  title: "Brand/Logo",
  component: Logo,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
The primary Hive Design System logo, rendered from pre-baked SVG assets.
Four marks (\`brain\`, \`simple\`, \`description\`, \`full\`) each ship in up
to three tones (\`color\`, \`black\`, \`white\`).

**When to use / when not** — Use \`Logo\` for the primary Hive identity in
any brand-forward context (headers, marketing, documentation covers).
Choose \`mark="full"\` for standalone lockups that must read as "Hive"
from a distance, \`simple\` (default) for compact/inline use, \`brain\` for
icon-only contexts, and \`description\` when a tagline needs to ship
attached to the mark. Reach for \`BrandMark\` instead when a single-letter
chip is more appropriate than the full identity (e.g. a footer credit).

**Do's & Don'ts** — Do pick \`tone\` to match the *surface*, not the
current color theme automatically: \`white\` for dark/brand-colored
surfaces, \`black\` for light neutral surfaces, \`color\` as the default
brand treatment. Don't request \`mark="full"\` with \`tone="black"\` or
\`tone="white"\` — that combination isn't in the asset set, and the
component silently falls back to the default simple-color mark, which
reads as a mistake rather than a deliberate choice (see the
"UnavailableCombination" story below).

**Accessibility** — Renders as a single \`role="img" aria-label="Hive"\`
element regardless of which SVG is inlined, so it announces once to
screen readers with no extra work needed at the call site.

**Relevant tokens** — None directly; each tone is a pre-baked static SVG
rather than a token-driven recolor, so pick \`tone\` explicitly per
surface instead of expecting it to follow \`data-theme\`.
        `,
      },
    },
  },
  argTypes: {
    tone: {
      control: "radio",
      options: ["color", "black", "white"],
    },
    mark: {
      control: "select",
      options: ["brain", "simple", "description", "full"],
    },
  },
  args: {
    tone: "color",
    mark: "simple",
  },
} satisfies Meta<typeof Logo>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
}

export const Full: Story = {
  args: {
    mark: "full",
    tone: "color",
  },
}

export const Brain: Story = {
  args: {
    mark: "brain",
  },
}

export const WithDescription: Story = {
  name: "With description",
  args: {
    mark: "description",
  },
}

export const BlackTone: Story = {
  name: "Black tone (on light surface)",
  parameters: {
    docs: {
      description: {
        story: "`tone=\"black\"` is meant for light neutral surfaces — shown here on an explicit light card regardless of the active Storybook theme.",
      },
    },
  },
  render: () => (
    <div style={{ background: "#f5f2f2", padding: 24, display: "flex", gap: 24, alignItems: "center" }}>
      <Logo tone="black" mark="simple" />
      <Logo tone="black" mark="brain" />
      <Logo tone="black" mark="description" />
    </div>
  ),
}

export const WhiteTone: Story = {
  name: "White tone (on dark surface)",
  parameters: {
    docs: {
      description: {
        story: "`tone=\"white\"` is meant for dark/brand-colored surfaces — shown here on an explicit dark card regardless of the active Storybook theme.",
      },
    },
  },
  render: () => (
    <div style={{ background: "#260a12", padding: 24, display: "flex", gap: 24, alignItems: "center" }}>
      <Logo tone="white" mark="simple" />
      <Logo tone="white" mark="brain" />
      <Logo tone="white" mark="description" />
    </div>
  ),
}

export const UnavailableCombination: Story = {
  name: "Unavailable combination (falls back)",
  parameters: {
    docs: {
      description: {
        story: "`mark=\"full\"` only exists in `tone=\"color\"`; requesting it with `tone=\"black\"` silently falls back to the default simple-color SVG. Avoid this pairing rather than relying on the fallback.",
      },
    },
  },
  args: {
    mark: "full",
    tone: "black",
  },
}
