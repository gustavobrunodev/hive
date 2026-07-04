import type { Meta, StoryObj } from "@storybook/react"
import type { ReactNode } from "react"

import { TypingIndicator } from "./TypingIndicator"

/**
 * Freezes the bounce animation at its peak frame (30% keyframe — dots
 * lifted, full opacity) for a legible, deterministic screenshot. Scoped to
 * this story only via a wrapper class + inline `<style>`, since the real
 * component always animates continuously in actual use.
 */
function StableFrameWrapper({ children }: { children: ReactNode }) {
  return (
    <div className="hds-story-stable-typing">
      <style>{`
        .hds-story-stable-typing .hds-typing-indicator-dot {
          animation-play-state: paused !important;
          animation-delay: -0.36s !important;
        }
      `}</style>
      {children}
    </div>
  )
}

/**
 * Replicates exactly what `@media (prefers-reduced-motion: reduce)` does in
 * `TypingIndicator.css` (`animation: none; opacity: 0.7`), so the story is
 * legible regardless of the browser/OS preference actually in effect.
 * Playwright validation additionally cross-checks the real media query via
 * `page.emulateMedia({ reducedMotion: 'reduce' })`.
 */
function ReducedMotionWrapper({ children }: { children: ReactNode }) {
  return (
    <div className="hds-story-reduced-motion-typing">
      <style>{`
        .hds-story-reduced-motion-typing .hds-typing-indicator-dot {
          animation: none !important;
          opacity: 0.7 !important;
        }
      `}</style>
      {children}
    </div>
  )
}

const meta = {
  title: "AI Chat/TypingIndicator",
  component: TypingIndicator,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
A three-dot "assistant is responding" indicator — \`role="status"\` so
screen readers announce \`label\` (default: "Assistant is responding")
without the visual dots being read as content (they're
\`aria-hidden="true"\`). The bounce animation collapses to a static, dimmed
state under \`prefers-reduced-motion: reduce\`.

**When to use / when not** — Use inside a \`MessageList\` (typically as the
last row) while waiting for the first token of a streaming response. Don't
use it as a generic loading spinner elsewhere — reach for \`Spinner\` for
non-chat loading states; this component's semantics (\`role="status"\`,
default label) are specifically about an assistant composing a reply.

**Do's & Don'ts**
- Do override \`label\` when the default "Assistant is responding" doesn't
  fit (e.g. a named agent: \`"Otto is typing"\`).
- Do remove the indicator from the DOM once the real response starts
  streaming in, rather than layering it under/behind the incoming content.
- Don't render more than one at a time in a single conversation — a second
  simultaneous status region is confusing for screen reader users navigating
  by landmarks/roles.
- Don't rely on the dots alone to convey "loading" — they're
  \`aria-hidden\`; the accessible label is what actually announces state.

**Accessibility** — \`role="status"\` is a polite live region: assistive
tech announces the label without interrupting the user's current task. The
three dots are purely decorative (\`aria-hidden="true"\`) and carry no
independent meaning. Motion respects \`prefers-reduced-motion: reduce\` by
disabling the keyframe animation and settling at a fixed, slightly dimmed
opacity rather than removing the indicator's visibility entirely.

**Relevant tokens** — \`--muted\` (dot fill), \`--s-2\`/\`--s-3\` (padding).
        `,
      },
    },
  },
} satisfies Meta<typeof TypingIndicator>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const StableFrame: Story = {
  render: (args) => (
    <StableFrameWrapper>
      <TypingIndicator {...args} />
    </StableFrameWrapper>
  ),
  parameters: {
    docs: {
      description: {
        story: "Animation paused at its peak frame for a deterministic, legible screenshot (the live component always animates).",
      },
    },
  },
}

export const CustomLabel: Story = {
  args: {
    label: "Otto is typing",
  },
  render: (args) => (
    <StableFrameWrapper>
      <TypingIndicator {...args} />
    </StableFrameWrapper>
  ),
}

export const ReducedMotion: Story = {
  render: (args) => (
    <ReducedMotionWrapper>
      <TypingIndicator {...args} />
    </ReducedMotionWrapper>
  ),
  parameters: {
    docs: {
      description: {
        story: "What `prefers-reduced-motion: reduce` produces in real usage — the bounce animation is fully disabled (not just paused) and the dots settle at a fixed, dimmed opacity.",
      },
    },
  },
}
