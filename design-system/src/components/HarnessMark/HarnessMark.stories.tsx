import type { Meta, StoryObj } from "@storybook/react"

import { HarnessMark } from "./HarnessMark"

const meta = {
  title: "Brand/HarnessMark",
  component: HarnessMark,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
The Harness Builder product mark — a hexagon "sharp hive" motif inherited
from the parent Hive brand, available as five lockups (\`symbol\`,
\`horizontal\`, \`stacked\`, \`wordmark\`, \`icon\`) and two tones (\`color\`,
\`mono\`).

**When to use / when not** — Pick the lockup by context, not preference:
\`icon\` for app-icon-shaped surfaces (favicons, app tiles), \`horizontal\`/
\`stacked\` when the wordmark needs to travel attached to the hex symbol,
\`wordmark\` for text-only contexts where the symbol would be redundant
(e.g. already inside an established header), and bare \`symbol\` for small
inline references where the wordmark would be illegible at that size.
Reserve \`tone="mono"\` for surfaces where the default coral/green
combination won't have enough contrast (a brand-colored background, or a
true single-color print context) — it isn't a stylistic alternative to
the default.

**Do's & Don'ts** — Do pass an explicit \`size\` for anything other than
default inline use: all four non-wordmark lockups derive their internal
gaps and wordmark scale from \`size\`, so overriding width/height with CSS
instead will desync the symbol/wordmark ratio. Do supply \`background\`
when nesting \`variant="icon"\` on a surface that clashes with the default
\`--bordo-2\` tile. Don't set \`endorsement={false}\` casually — the "Uma
skill · HIVE" caption is the visual link back to the parent Hive brand;
drop it only in tight UI chrome where the extra line genuinely doesn't fit.

**Accessibility** — Every lockup renders as a single \`role="img"
aria-label="Harness Builder"\` element with the inner SVG marked
\`aria-hidden\`, so screen readers get one clean announcement regardless
of variant — no per-variant labeling is needed at the call site. When
using \`tone="mono"\` with a custom \`color\`, verify the result still
clears 3:1 against its host background (the component does not check
this for you).

**Relevant tokens** — \`--coral\` (stroke, color tone), \`--verde\` (core,
color tone), \`--bordo-2\` (default icon-tile background), \`--ink\`
(default wordmark color).
        `,
      },
    },
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["symbol", "horizontal", "stacked", "wordmark", "icon"],
    },
    tone: {
      control: "radio",
      options: ["color", "mono"],
    },
    color: { control: "color" },
    size: { control: "number" },
    background: { control: "color" },
    endorsement: { control: "boolean" },
  },
  args: {
    variant: "symbol",
    tone: "color",
    size: 56,
    endorsement: true,
  },
} satisfies Meta<typeof HarnessMark>

export default meta

type Story = StoryObj<typeof meta>

export const SymbolOnly: Story = {
  name: "Symbol",
  args: {
    variant: "symbol",
    size: 56,
  },
}

export const Horizontal: Story = {
  args: {
    variant: "horizontal",
    size: 44,
  },
}

export const Stacked: Story = {
  args: {
    variant: "stacked",
    size: 56,
  },
}

export const Wordmark: Story = {
  args: {
    variant: "wordmark",
    size: 26,
  },
}

export const WordmarkNoEndorsement: Story = {
  name: "Wordmark (no endorsement)",
  args: {
    variant: "wordmark",
    size: 26,
    endorsement: false,
  },
}

export const Icon: Story = {
  parameters: {
    docs: {
      description: {
        story: "`variant=\"icon\"` renders a squared app-icon tile; `background` overrides the default `--bordo-2` fill, and `tone=\"mono\"` still applies inside the tile.",
      },
    },
  },
  render: () => (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      <HarnessMark variant="icon" size={96} />
      <HarnessMark variant="icon" size={96} background="var(--bordo-sensatez)" />
      <HarnessMark variant="icon" size={96} background="var(--coral)" tone="mono" color="#260a12" />
    </div>
  ),
}

export const Mono: Story = {
  name: "Mono tone",
  args: {
    variant: "horizontal",
    size: 44,
    tone: "mono",
  },
}

export const OnNegativeBackground: Story = {
  name: "On negative background",
  parameters: {
    docs: {
      description: {
        story: "`tone=\"mono\"` with an explicit `color` is the recommended treatment for placing the mark on a brand-colored surface, where the default color tone would lose contrast.",
      },
    },
  },
  render: () => (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      <span style={{ background: "var(--coral)", padding: 20, display: "inline-flex" }}>
        <HarnessMark variant="horizontal" size={40} tone="mono" color="#260a12" />
      </span>
      <span style={{ background: "var(--bordo-sensatez)", padding: 20, display: "inline-flex" }}>
        <HarnessMark variant="horizontal" size={40} tone="mono" color="#ded4d4" />
      </span>
    </div>
  ),
}
