import type { Meta, StoryObj } from "@storybook/react"

import { DotsBackground } from "./DotsBackground"

const meta = {
  title: "Utilities/DotsBackground",
  component: DotsBackground,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: `
Decorative dot-dispersion gradient (the DS's signature "never a simple
linear/radial gradient" texture) — two layered radial dot-grids masked into
soft, off-center clusters. Renders \`aria-hidden="true"\`, absolutely
positioned to fill its nearest positioned ancestor.

**When to use / when not**
- Use as a background layer inside a \`position: relative\` section/hero that
  needs the brand's dot-dispersion texture — it fills \`inset: 0\` of its
  parent, so the parent must establish the positioning context and a real
  height.
- Don't use it as a full-bleed page background by itself — it's meant to sit
  behind real content (\`z-index: 0\`), not as a standalone visual.

**Do's & Don'ts**
- Do give the parent container \`position: relative\` (or \`absolute\`/\`fixed\`)
  and an explicit height — without one, this component (itself
  \`position: absolute; inset: 0\`) collapses to zero size.
- Don't stack real interactive content behind it without a higher \`z-index\`
  — it sits at \`z-index: 0\` precisely so ordinary content (which should use
  \`position: relative\` + default stacking, or an explicit higher z-index)
  paints above it.

**A11y**
- \`aria-hidden="true"\` is set unconditionally — it never enters the
  accessibility tree and needs no label.
- \`pointer-events: none\` — never intercepts clicks meant for content above it.

**Relevant tokens**: \`--bordo-sensatez\`, \`--coral\` — both used raw (not
semantic roles) for the two dot layers, matching this DS's convention that
decorative brand-gradient/dot textures intentionally stay unthemed across
light/dark (see \`.specs/project/STATE.md\`'s "Lessons").
        `,
      },
    },
  },
} satisfies Meta<typeof DotsBackground>

export default meta

type Story = StoryObj<typeof meta>

/**
 * Framed in a bordered, sized container (rather than filling the whole
 * canvas invisibly) so the texture's extent and both dot layers are visible.
 */
export const Framed: Story = {
  render: () => (
    <div
      style={{
        position: "relative",
        height: 320,
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--rounded-md, 8px)",
        overflow: "hidden",
        background: "var(--bg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <DotsBackground />
      <p style={{ position: "relative", zIndex: 1, color: "var(--ink)", margin: 0 }}>
        Real content sits above the dots via default stacking order.
      </p>
    </div>
  ),
}
