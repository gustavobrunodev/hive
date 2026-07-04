import type { Meta, StoryObj } from "@storybook/react"

import { SectionHeading } from "./SectionHeading"

const meta = {
  title: "Layout/SectionHeading",
  component: SectionHeading,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: `
A brand-register section heading: an optional eyebrow label, an \`<h2>\`, a
short accent rule, and an optional lead paragraph — the recurring shape used
to open a marketing section.

**When to use / when not** — Use \`SectionHeading\` to open a marketing-site
section (About, Process, Pricing) where the eyebrow + rule + lead shape is
the established pattern. Don't use it in product/app UI — it's sized and
spaced for full-bleed marketing sections (\`clamp()\`-based display type, a
62ch max-width), not a settings-page or panel header; PRODUCT.md's fixed-rem
type scale governs product surfaces instead.

**Do's & Don'ts**
- Do pass an \`id\` when the heading is a scroll/anchor target (e.g. linked
  from a nav) — it's forwarded straight to the \`<h2>\`, not the wrapper.
- Do keep the eyebrow short (a word or two) — it has no line-wrap treatment
  of its own and is meant to read as a single label, not a phrase.
- Don't skip heading levels around it — \`SectionHeading\` always renders an
  \`<h2>\`; nest subsequent content under \`<h3>\`+ to keep the outline correct.
- Don't use the \`lead\` slot for anything longer than a sentence or two — it's
  capped at a 60ch reading measure by design, not a general-purpose body slot.

**A11y** — Renders a real \`<h2>\` (not a styled \`div\`), so it participates
correctly in the document outline and is reachable via heading-level screen
reader navigation. The eyebrow and rule are purely decorative \`span\`/\`div\`
elements with no announced role — the heading text itself is the only
accessible content besides the optional lead paragraph.

**Relevant tokens** — \`--accent\` (eyebrow text/rule color), \`--muted\` (lead
paragraph text); heading size uses the marketing \`clamp()\` scale, not a
token.
`,
      },
    },
  },
} satisfies Meta<typeof SectionHeading>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    children: "How we work",
  },
}

export const WithEyebrow: Story = {
  args: {
    eyebrow: "Process",
    children: "How we work",
  },
}

export const WithLead: Story = {
  args: {
    children: "How we work",
    lead: "A short, focused engagement model — discovery, build, and a clean handoff, with no surprise scope along the way.",
  },
}

export const FullyPopulated: Story = {
  args: {
    eyebrow: "Process",
    children: "How we work",
    lead: "A short, focused engagement model — discovery, build, and a clean handoff, with no surprise scope along the way.",
  },
}

export const WithAnchorId: Story = {
  args: {
    id: "how-we-work",
    eyebrow: "Process",
    children: "How we work",
  },
}
