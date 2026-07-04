import type { Meta, StoryObj } from "@storybook/react"

import { VisuallyHidden } from "./VisuallyHidden"

const meta = {
  title: "Utilities/VisuallyHidden",
  component: VisuallyHidden,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
Content that stays in the accessibility tree (readable by screen readers,
focusable if the wrapped element is) while being clipped from sighted view.
Thin re-export over Radix's \`VisuallyHidden.Root\`.

**When to use / when not**
- Use to give an icon-only control (e.g. a \`Spinner\`, an icon button) an
  accessible name without adding visible text.
- Don't use it to "hide" content that should really be removed from the DOM
  (e.g. a closed panel) — this component keeps content mounted and reachable
  by assistive tech and tab order; \`display:none\`/conditional rendering are
  the right tools for content that shouldn't exist at all right now.

**Do's & Don'ts**
- Do put real, complete sentence-like text inside — it's read verbatim by
  screen readers, so terse fragments like "Loading" over "Loading, please
  wait" both work, but avoid ambiguous single words with no context.
- Don't nest interactive elements you don't want reachable by keyboard —
  content stays focusable, so a hidden button here is still tabbable.

**A11y**
- This is a pure accessibility primitive: renders \`position:absolute\`,
  \`1px×1px\`, \`overflow:hidden\`, \`clip-path\` — the standard clip technique,
  not \`display:none\`/\`visibility:hidden\` (both of which *would* remove it
  from the accessibility tree).

**Relevant tokens**: none — purely positional/clip CSS, no visual/theme tokens.
        `,
      },
    },
  },
} satisfies Meta<typeof VisuallyHidden>

export default meta

type Story = StoryObj<typeof meta>

/**
 * VisuallyHidden renders no visible pixels by design. This story frames it
 * next to a dashed-outline explanatory overlay so a reader can see *where*
 * the hidden content sits, rather than shipping a seemingly blank canvas.
 */
export const Framed: Story = {
  render: () => (
    <div
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 48,
        height: 48,
        border: "1px dashed var(--border-strong)",
        borderRadius: "var(--rounded-md, 6px)",
        color: "var(--ink)",
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 20 }}>
        ★
      </span>
      <VisuallyHidden>Favoritar item</VisuallyHidden>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "The dashed box and star are the only visible pixels. The real accessible name (\"Favoritar item\") is announced to screen readers via the invisible `VisuallyHidden` child — inspect this story's accessibility tree (or the a11y addon panel) to confirm it's present.",
      },
    },
  },
}
