import type { CSSProperties } from "react"
import type { Meta, StoryObj } from "@storybook/react"

import { Reveal, Stagger } from "./Reveal"

const meta = {
  title: "Utilities/Reveal",
  component: Reveal,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: `
Scroll-triggered entrance animation. \`Reveal\` fades/slides a single block in
once it crosses into the viewport (\`IntersectionObserver\`, 16% threshold);
\`Stagger\` does the same for a list of children with a per-item delay driven
by a \`--i\` custom property. Honors \`prefers-reduced-motion\`: when reduced
motion is on (or \`IntersectionObserver\` is unsupported), content renders
already-revealed with no animation and no observer is created at all.

**When to use / when not**
- Use for marketing/landing-page sections that benefit from a subtle
  scroll-driven entrance (cards, section headings, hero copy blocks).
- Don't use inside app-shell/product UI (dialogs, forms, chat) — those need
  to be immediately visible and interactive; a scroll-triggered fade adds
  latency to functional content, not polish.
- Don't wrap something that's already inside the initial viewport for most
  users expecting to interact with it right away (e.g. a primary CTA above
  the fold) — its 0.7s fade-in delays perceived interactivity for no benefit.

**Do's & Don'ts**
- Do use \`Stagger\` (not several \`Reveal\`s) for a list/grid of siblings that
  should cascade in together — it manages one shared observer + per-child
  delay via CSS, rather than N independent observers.
- Do pass \`as\` when the wrapped content has real semantics (e.g.
  \`as="section"\`, \`as="ul"\` for \`Stagger\`) — both default to a bare \`div\`.
- Don't rely on this component for anything the user must act on immediately;
  \`isIn\` only flips once per mount (\`io.unobserve\` fires after the first
  intersection), so it never re-hides on scroll-away.

**A11y**
- No ARIA role or focus behavior of its own — it's a pure CSS/opacity
  transition wrapper around whatever semantic element \`as\` renders.
- \`prefers-reduced-motion: reduce\` is honored natively (both via the hook's
  own check and a global CSS override in \`base.css\`) — content is never
  motion-gated for users who've opted out of animation.

**Relevant tokens**: \`--ease-expo\` (transition timing function); no color
tokens — purely opacity/transform.
        `,
      },
    },
  },
} satisfies Meta<typeof Reveal>

export default meta

type Story = StoryObj<typeof meta>

const cardStyle: CSSProperties = {
  padding: 24,
  border: "1px solid var(--border-strong)",
  borderRadius: "var(--rounded-md, 8px)",
  background: "var(--surface)",
  color: "var(--ink)",
  maxWidth: 420,
  margin: "0 auto",
}

/**
 * Real scroll-triggered demo: a tall spacer keeps the `Reveal` block below
 * the fold on load (not-yet-revealed state), so scrolling it into view in a
 * genuine browser exercises the real `IntersectionObserver` — the exact
 * behavior this component can't be unit-tested for (see `Reveal.test.tsx`,
 * which mocks the hook instead). Playwright MCP: screenshot immediately on
 * load (hidden), then again after scrolling the block into view (revealed).
 */
export const ScrollToReveal: Story = {
  render: () => (
    <div>
      <div
        style={{
          height: "90vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--ink-muted, var(--ink))",
        }}
      >
        Scroll down ↓ to trigger the reveal
      </div>
      <Reveal style={cardStyle} data-testid="reveal-target">
        <h3 style={{ margin: "0 0 8px" }}>Revealed content</h3>
        <p style={{ margin: 0 }}>
          This card starts at <code>opacity: 0</code> / translated 22px down, and
          animates in the moment it crosses 16% into the viewport.
        </p>
      </Reveal>
      <div style={{ height: "50vh" }} />
    </div>
  ),
}

/**
 * `Stagger` cascades its direct children in with a per-item delay. Scroll
 * this story's list into view to see the cascade (each child needs its own
 * `--i` custom property set inline to control delay order).
 */
export const StaggeredList: Story = {
  render: () => (
    <div>
      <div style={{ height: "90vh" }} />
      <Stagger
        as="ul"
        style={{ maxWidth: 420, margin: "0 auto", padding: 0, listStyle: "none" }}
      >
        {["First", "Second", "Third", "Fourth"].map((label, i) => (
          <li
            key={label}
            style={{ ...cardStyle, marginBottom: 12, ["--i" as string]: i }}
          >
            {label} item
          </li>
        ))}
      </Stagger>
      <div style={{ height: "50vh" }} />
    </div>
  ),
}

/**
 * `prefers-reduced-motion: reduce` short-circuits the hook entirely — content
 * renders already-revealed (`isIn` starts `true`, no observer created). This
 * story documents the branch rather than re-demonstrating it live (Playwright
 * MCP has no built-in reduced-motion emulation toggle for the iframe; the
 * behavior is unit-tested directly in `Reveal.test.tsx` by mocking the hook).
 */
export const ReducedMotionFallback: Story = {
  render: () => (
    <div style={{ padding: 24 }}>
      <Reveal style={cardStyle}>
        <p style={{ margin: 0 }}>
          With <code>prefers-reduced-motion: reduce</code> set at the OS/browser
          level, this card renders fully visible on first paint — no fade, no
          scroll-trigger, no <code>IntersectionObserver</code> instantiated at
          all (see the early-return branch in <code>useReveal.ts</code>).
        </p>
      </Reveal>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Emulate this by enabling 'Emulate CSS media feature prefers-reduced-motion' in your browser devtools, or the OS-level reduced-motion setting, then reload this story.",
      },
    },
  },
}
