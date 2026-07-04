import type { Meta, StoryObj } from "@storybook/react"

import { Nav } from "./Nav"

const USAGE = `
**When to use / when not** — Nav is the sticky, page-level header: brand
mark + primary link row + one optional CTA button. Use it once per page, at
the top. Don't reach for it as an in-page section switcher (\`Tabs\`) or a
hierarchy trail (\`Breadcrumb\`) — Nav only knows about a flat list of
top-level destinations.

**Do's & Don'ts**
- Do keep \`links\` short (4–6 entries) — Nav.css hides the entire link row
  below a 760px viewport with no built-in mobile-menu fallback, so a long
  list simply disappears on narrow screens rather than degrading gracefully.
- Do pass at most one \`cta\`; there's only a single CTA slot, always rendered
  as a \`Button\` (an \`<a>\`, since \`cta.href\` is required) after the links.
- Don't expect an "active/current page" treatment — \`NavLink\` is just
  \`{ href, label }\`; the component renders plain \`<a>\`s with no
  \`aria-current\` or active-class hook. If a page needs to visually mark the
  current link, that has to happen outside this component (e.g. a custom
  \`Nav\` variant or post-render DOM styling) — it's not part of today's frozen
  API.
- Don't omit \`brand\`/pass an empty \`links\` array expecting the row to
  collapse gracefully in layout — Nav always renders the brand link; only the
  links \`<nav>\` and the CTA are conditional.

**A11y** — The root is a \`<header>\`; the link row is its own
\`<nav aria-label="Navegação principal">\` so assistive tech can jump straight
to primary navigation, distinguishing it from the outer \`<header>\` landmark.
The brand and every link are real \`<a href>\`s (keyboard-reachable, no
custom tab-index games); the CTA reuses \`Button\`'s own focus-visible ring.

**Relevant tokens** — \`--border\` (bottom rule), \`--ink\` (brand text, hover
state on links), \`--muted\` (default link color). Note: the header background
(\`rgba(38, 10, 18, 0.82)\` + \`backdrop-filter: blur\`) is an intentional raw
brand-tint overlay in Nav.css, not a semantic surface token — it's tuned for
the sticky-over-content blur effect specifically, independent of theme.
`

const meta = {
  title: "Navigation/Nav",
  component: Nav,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: { description: { component: USAGE } },
  },
} satisfies Meta<typeof Nav>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    brand: "Harness",
    brandHref: "#top",
    links: [
      { href: "#product", label: "Product" },
      { href: "#docs", label: "Docs" },
      { href: "#pricing", label: "Pricing" },
    ],
    cta: { href: "#signup", label: "Get started" },
  },
}

export const WithoutCta: Story = {
  args: {
    brand: "Harness",
    links: [
      { href: "#product", label: "Product" },
      { href: "#docs", label: "Docs" },
      { href: "#about", label: "About" },
    ],
  },
}

export const BrandOnly: Story = {
  name: "Brand only (no links, no CTA)",
  args: {
    brand: "Harness",
  },
}

export const ManyLinks: Story = {
  name: "Many links (visual limit reference)",
  args: {
    brand: "Harness",
    links: [
      { href: "#product", label: "Product" },
      { href: "#solutions", label: "Solutions" },
      { href: "#docs", label: "Docs" },
      { href: "#pricing", label: "Pricing" },
      { href: "#blog", label: "Blog" },
      { href: "#about", label: "About" },
    ],
    cta: { href: "#signup", label: "Get started" },
  },
}
