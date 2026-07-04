import type { Meta, StoryObj } from "@storybook/react"

import { withFixedHeight } from "../../../.storybook/decorators"
import { MessageList } from "./MessageList"
import { ChatMessage, type ChatMessageRole } from "../ChatMessage/ChatMessage"
import { TypingIndicator } from "../TypingIndicator/TypingIndicator"
import { Avatar } from "../Avatar/Avatar"

const TURNS = [
  "Can you walk me through what changed in this diff?",
  "Sure — the `MessageList` component now threads a `viewportRef` down to `ScrollArea` so it can read real scroll position instead of guessing from the wrapper.",
  "Why couldn't it just use the ref `ScrollArea` already returns?",
  "`ScrollArea`'s own ref only reaches the Radix `Root` (the outer wrapper) — the actual scrolling node is the `Viewport` one level in, so anything that needs `scrollTop`/`scrollHeight` (like pin-to-latest) needs a way to reach past the wrapper.",
  "Got it. Does it still work if I paste in a huge file?",
  "Yes — the bubble caps at 640px/80% width and wraps, so long content grows the row's height rather than its width.",
  "One more thing: what happens if I've scrolled up to re-read something and a new message arrives?",
  "It stays put — auto-scroll only kicks in while you're already pinned near the bottom. Scroll up and a \"Jump to latest\" button appears instead of yanking you back down.",
]

function seedMessages(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const role: ChatMessageRole = i % 2 === 0 ? "user" : "assistant"
    const text = TURNS[i % TURNS.length]
    return (
      <ChatMessage
        key={i}
        role={role}
        avatar={<Avatar fallback={role === "user" ? "GB" : "AI"} size="md" />}
        timestamp={`10:${String(i).padStart(2, "0")} AM`}
      >
        {text}
      </ChatMessage>
    )
  })
}

const meta = {
  title: "AI Chat/MessageList",
  component: MessageList,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: `
An auto-scrolling conversation container, built on \`ScrollArea\`. It stays
pinned to the latest message while the user is already near the bottom, and
surfaces a floating "Jump to latest" button the moment the user scrolls away
— the same pattern chat apps (Slack, Discord, ChatGPT) use so that reading
older messages is never interrupted by new ones yanking the viewport down.
Generic per D4: it renders whatever \`children\` the app supplies (typically
\`ChatMessage\`/\`TypingIndicator\` rows) with no message-shape assumptions.

**When to use / when not** — Use \`MessageList\` for the scrollable region of
any conversation UI where new content can arrive while the user is reading
(streaming tokens, new turns, a typing indicator). Don't reach for it for a
static, finite list that never grows after mount (e.g. a fixed FAQ) — plain
\`ScrollArea\` is enough there, and the pin-tracking overhead buys nothing.

**Do's & Don'ts**
- Do give \`MessageList\` (or an ancestor) a bounded height — like \`ScrollArea\`,
  it has no opinion on its own size; \`.hds-message-list\` is a \`flex\` column
  with \`height: 100%\`, so it fills whatever box it's placed in.
- Do let streaming content grow inside the existing last message rather than
  appending a new row per token — the pin logic reacts to a \`ResizeObserver\`
  on the content wrapper, so any height change (a growing bubble or a newly
  appended row) triggers the same "stay pinned or don't" check.
- Do tune \`bottomThreshold\` (default \`80\`px) if messages are unusually tall —
  a small threshold on a list of tall bubbles can make the user feel "unpinned"
  after a very small upward scroll.
- Don't call anything that force-scrolls the viewport from outside this
  component (e.g. \`scrollIntoView\` on a child) — it fights the pin state
  machine, which only trusts its own \`scroll\`/\`ResizeObserver\` listeners.
- Don't expect the "Jump to latest" button to appear in Storybook's static
  canvas without an actual scroll gesture — it's driven entirely by a real
  \`scroll\` event on the underlying viewport, which jsdom-style prop controls
  can't simulate; scroll the pane (wheel/trackpad/keyboard) to see it.

**Accessibility** — The scrolling behavior itself is native (a real
\`overflow: auto\` viewport under \`ScrollArea\`'s chrome), so wheel, trackpad,
touch, and keyboard (\`PageUp\`/\`PageDown\`/arrow keys once focused) all work
without any custom key handling. \`prefers-reduced-motion: reduce\` swaps the
smooth "jump to latest" scroll for an instant jump (see \`prefersReducedMotion\`
in \`MessageList.tsx\`), and disables the button's hover-lift transition. The
component does not itself assign \`role="log"\`/\`aria-live\` to the scrolling
region — per \`ChatMessage\`'s docs, that's a decision left to the app (an
always-on live region announcing every streaming token is usually too noisy;
apps typically announce only that new messages arrived, e.g. via the "Jump to
latest" button's own visibility).

**Relevant tokens** — \`--s-4\` (content padding/gap), \`--surface\`/\`--ink\`/
\`--border\` (jump button chrome), \`--shadow-2\` (jump button elevation),
\`--rounded-full\` (jump button shape), \`--focus\` (jump button focus ring).
        `,
      },
    },
  },
} satisfies Meta<typeof MessageList>

export default meta

type Story = StoryObj<typeof meta>

/** A short conversation that doesn't overflow the pane — no scrollbar, no jump button. */
export const ShortConversation: Story = {
  decorators: [withFixedHeight(320)],
  args: {
    children: seedMessages(3),
  },
}

/**
 * Enough messages to overflow the fixed-height pane. Mounts pinned to the
 * latest turn — scroll up (wheel/trackpad/keyboard) to see the "Jump to
 * latest" button appear, then scroll back down (or click it) to see it
 * disappear again. This story is the primary Playwright validation surface
 * for the pin-to-latest behavior (CONCERNS.md's ResizeObserver-driven
 * scrolling, real-browser-only).
 */
export const OverflowingConversation: Story = {
  decorators: [withFixedHeight(360)],
  args: {
    children: seedMessages(16),
  },
}

/** The trailing row while waiting on the first streaming token. */
export const WithTypingIndicator: Story = {
  decorators: [withFixedHeight(360)],
  args: {
    children: (
      <>
        {seedMessages(6)}
        <TypingIndicator />
      </>
    ),
  },
}

/** A custom label for the floating jump-to-latest affordance. */
export const CustomJumpLabel: Story = {
  decorators: [withFixedHeight(320)],
  args: {
    jumpToLatestLabel: "New messages",
    children: seedMessages(16),
  },
  parameters: {
    docs: {
      description: {
        story: "Scroll up to reveal the button with its custom label (the default is \"Jump to latest\").",
      },
    },
  },
}
