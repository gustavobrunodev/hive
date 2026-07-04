import type { Meta, StoryObj } from "@storybook/react"

import { Breadcrumb } from "./Breadcrumb"

const USAGE = `
**When to use / when not** — Breadcrumb orients a user inside a known
hierarchy (folder path, category drill-down, wizard-adjacent settings pages)
so they can jump back to any ancestor in one click. Don't use it as the
page's primary navigation (that's \`Nav\`'s job) and don't use it for a
strictly linear, non-hierarchical sequence — a numbered flow reads better as
\`SteppedList\`/\`Timeline\`.

**Do's & Don'ts**
- Do always pass the full ancestor chain in \`items\`, including the current
  page as the last entry — the component marks that last entry current
  automatically (\`aria-current="page"\`) regardless of whether it has
  \`href\`/\`onClick\`.
- Do set \`maxItems\` once a path gets deep (5+ segments); collapsing keeps the
  first and last items and folds the middle into a single, non-interactive
  \`…\` — it never hides the root or the current page.
- Don't rely on \`maxItems\` for *visual* truncation of a single long label —
  it only collapses the *count* of segments; an individual label that's too
  long to fit still needs its own \`className\`/\`max-width\` treatment (the
  shipped CSS doesn't clip label text).
- Don't give the trailing segment an \`href\`/\`onClick\` expecting it to stay
  interactive — \`current\` always wins and renders a static, non-clickable
  \`<span>\`.

**A11y** — The root is a \`<nav aria-label="Breadcrumb">\` wrapping an \`<ol>\`
(order is semantically meaningful). Each non-current segment is a real
\`<a href>\` or \`<button>\` (never a \`<span>\` pretending to be clickable) so
it's reachable via Tab and activates on Enter/Space; the separator (\`/\`) and
collapsed-ellipsis (\`…\`) glyphs are \`aria-hidden\` decoration, not part of the
accessible name sequence.

**Relevant tokens** — \`--muted\`/\`--ink\` (default/current segment color),
\`--surface-2\` (hover background), \`--faint\` (separator + ellipsis),
\`--focus\` (focus ring), \`--rounded-sm\`.
`

const meta = {
  title: "Navigation/Breadcrumb",
  component: Breadcrumb,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: { description: { component: USAGE } },
  },
} satisfies Meta<typeof Breadcrumb>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    items: [
      { label: "Home", href: "#home" },
      { label: "Documentation", href: "#docs" },
      { label: "Components" },
    ],
  },
}

export const Interactive: Story = {
  name: "With onClick handlers",
  args: {
    items: [
      { label: "Home", onClick: () => window.alert("Navigate: Home") },
      { label: "Settings", onClick: () => window.alert("Navigate: Settings") },
      { label: "Profile" },
    ],
  },
}

/**
 * With 7 items and `maxItems={4}`, the middle collapses into a single
 * non-interactive `…` — only the first item, the ellipsis, and the last 2
 * trailing items render (first + ellipsis + tailCount, where
 * `tailCount = max(maxItems - 2, 1)`).
 */
export const Truncated: Story = {
  args: {
    maxItems: 4,
    items: [
      { label: "Home", href: "#home" },
      { label: "Products", href: "#products" },
      { label: "Category", href: "#category" },
      { label: "Subcategory", href: "#subcategory" },
      { label: "Collection", href: "#collection" },
      { label: "Item Group", href: "#item-group" },
      { label: "Current Item" },
    ],
  },
}

export const ShortNoTruncation: Story = {
  name: "maxItems above item count (no-op)",
  args: {
    maxItems: 6,
    items: [
      { label: "Home", href: "#home" },
      { label: "Blog" },
    ],
  },
}
