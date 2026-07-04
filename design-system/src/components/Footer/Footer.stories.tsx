import type { Meta, StoryObj } from "@storybook/react"

import { Footer } from "./Footer"

const meta = {
  title: "Brand/Footer",
  component: Footer,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: `
A full-width, page-level closing landmark: a brand block (\`BrandMark\` +
\`brand\`) and \`tagline\` on top, with an optional row of \`bottomItems\`
(e.g. legal links) below.

**When to use / when not** — Use \`Footer\` as the last element of a page,
directly under the content — its layout math assumes it owns the full
inline width to distribute the brand block against the tagline. Don't
reach for it as a generic two-column layout primitive elsewhere; its
wrap/stack breakpoints are tuned specifically for short footer content
(a brand lockup, a one-line tagline, optional legal links), not arbitrary
page content.

**Do's & Don'ts** — Do pass \`bottomItems\` as an array of already-composed
elements (typically \`<a>\` tags); the component only maps and keys them,
adding no styling beyond a muted/hover color. Do keep \`tagline\` short —
it's capped at \`max-width: 42ch\`, designed for a single short sentence,
not a paragraph. Don't worry about conditionally omitting the bottom row
yourself: leaving \`bottomItems\` as its default empty array already
hides that row entirely rather than rendering an empty one. Do check both
a wide canvas and a narrow (<760px) one — the top row wraps and the
bottom row switches from a horizontal spread to a stacked column, and
both \`--border\` and \`--muted\` are theme-flipped roles, so the footer's
divider and text treatment differ between light and dark.

**Accessibility** — The root element is a native \`<footer>\`, which
already carries the \`contentinfo\` landmark role — avoid wrapping it in
another landmark element that would demote or duplicate that role.
\`bottomItems\` links need their own accessible names (visible link text
is sufficient); the component adds none of its own.

**Relevant tokens** — \`--border\` (top divider), \`--muted\` (tagline and
bottom-row text, theme-flipped), \`--ink\` (bottom-link hover state),
\`--ff-display\` (brand block font).
        `,
      },
    },
  },
  args: {
    brand: "Hive",
    tagline: "A design system built to last — for products that ship.",
  },
} satisfies Meta<typeof Footer>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
}

export const WithBottomLinks: Story = {
  name: "With bottom links",
  args: {
    bottomItems: [
      <a href="#privacy">Privacy</a>,
      <a href="#terms">Terms</a>,
      <span>© {new Date().getFullYear()} Hive</span>,
    ],
  },
}

export const NarrowViewport: Story = {
  name: "Narrow viewport (stacked bottom row)",
  parameters: {
    docs: {
      description: {
        story: "Below 760px the bottom row switches from a horizontal spread to a stacked column; the canvas here is constrained to demonstrate that breakpoint.",
      },
    },
  },
  args: {
    bottomItems: [
      <a href="#privacy">Privacy</a>,
      <a href="#terms">Terms</a>,
      <span>© {new Date().getFullYear()} Hive</span>,
    ],
  },
  render: (args) => (
    <div style={{ maxWidth: 480, margin: "0 auto" }}>
      <Footer {...args} />
    </div>
  ),
}
