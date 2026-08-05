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
Six marks (\`brain\`, \`simple\`, \`description\`, \`full\`, \`lockup\`,
\`mark\`) each ship in up to four tones (\`color\`, \`black\`, \`white\`,
\`current\`).

**When to use / when not** — Use \`Logo\` for the primary Hive identity in
any brand-forward context (headers, marketing, documentation covers).
Choose \`mark="full"\` for standalone lockups that must read as "Hive"
from a distance, \`simple\` (default) for compact/inline use, \`brain\` for
icon-only contexts, and \`description\` when a tagline needs to ship
attached to the mark. For **app chrome** — a title bar, a gate screen —
reach for \`mark="lockup"\`: the mark and the wordmark side by side, so
the identity fits a surface that has width to spare and no height, and
\`mark="mark"\` for the symbol alone at chrome scale. Reach for
\`BrandMark\` instead when a single-letter chip is more appropriate than
the full identity (e.g. a footer credit).

**Do's & Don'ts** — Do pick \`tone\` to match the *surface*, not the
current color theme automatically: \`white\` for dark/brand-colored
surfaces, \`black\` for light neutral surfaces, \`color\` as the default
brand treatment, and \`current\` where the surface itself is themed and
the logo should simply follow its container's text color. Don't request
\`mark="full"\` with \`tone="black"\` or \`tone="white"\` — that combination
isn't in the asset set, and the component silently falls back to the
default simple-color mark, which reads as a mistake rather than a
deliberate choice (see the "UnavailableCombination" story below).

**Sizing** — \`lockup\` and \`mark\` are cropped to the artwork, so a CSS
\`height\` on the inner \`svg\` is the rendered height. The delivered
\`brain\`/\`simple\`/\`description\` stacks are not: they sit on a 1408×768
canvas that the drawing fills only ~20% of, so a "20px logo" paints a
~4px mark unless the caller crops the viewBox itself.

**Accessibility** — Renders as a single \`role="img" aria-label="Hive"\`
element regardless of which SVG is inlined, so it announces once to
screen readers with no extra work needed at the call site.

**Relevant tokens** — \`tone="current"\` is the only token-aware treatment:
it inherits \`color\`, and exposes \`--hds-logo-mark\` /
\`--hds-logo-wordmark\` for the two-color treatment (an accent mark against
an ink wordmark). The other tones are pre-baked static SVGs, so pick
\`tone\` explicitly per surface instead of expecting it to follow
\`data-theme\`.
        `,
      },
    },
  },
  argTypes: {
    tone: {
      control: "radio",
      options: ["color", "black", "white", "current"],
    },
    mark: {
      control: "select",
      options: ["brain", "simple", "description", "full", "lockup", "mark"],
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

export const Lockup: Story = {
  name: "Lockup (app chrome)",
  parameters: {
    docs: {
      description: {
        story:
          "The horizontal arrangement, at the sizes app chrome actually uses. `tone=\"current\"` inherits `color`, so one element serves every theme; `--hds-logo-mark` colors the symbol on its own for the two-color treatment.",
      },
    },
  },
  render: () => (
    <div style={{ background: "#1c1a1a", color: "#ded4d4", padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      {[20, 28, 44].map((height) => (
        <div key={height} style={{ display: "flex", gap: 32, alignItems: "center" }}>
          <Logo tone="current" mark="lockup" style={{ ["--hds-logo-height" as string]: `${height}px` }} />
          <Logo
            tone="current"
            mark="lockup"
            style={{
              ["--hds-logo-height" as string]: `${height}px`,
              ["--hds-logo-mark" as string]: "#cc7958",
            }}
          />
          <Logo tone="current" mark="mark" style={{ ["--hds-logo-height" as string]: `${height}px` }} />
        </div>
      ))}
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
