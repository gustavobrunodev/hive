import type { Meta, StoryObj } from "@storybook/react"

import { ChatMessage } from "./ChatMessage"
import { Avatar } from "../Avatar/Avatar"
import { Button } from "../Button/Button"

const meta = {
  title: "AI Chat/ChatMessage",
  component: ChatMessage,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: `
A single chat message row — role-based alignment and tinted bubble chrome,
with avatar/timestamp/actions slots. Generic per DS design.md's D4: no
transport, no model calls, no markdown parsing. The consuming app renders
the message body (plain text, or already-rendered markdown/HTML) and passes
it as \`children\`; \`ChatMessage\` only owns layout and role styling.

**When to use / when not** — Use for every turn in a \`MessageList\`
(user, assistant, or system). Don't reach for it outside a conversation
context (e.g. a generic comment or notification card): the user/assistant
mirrored alignment and the hover-reveal actions pattern are chat-specific
conventions, not a general "message" primitive.

**Do's & Don'ts**
- Do pass already-rendered content as \`children\` — this component never
  parses markdown, sanitizes HTML, or renders code blocks itself.
- Do supply \`avatar\` for \`user\`/\`assistant\` roles; omit it for \`system\`
  (system rows render centered and muted, with no avatar column).
- Do keep \`actions\` to a small icon-button cluster (copy/retry/etc.) — they
  reveal on hover/focus-within, so more than two or three controls crowd the
  row on focus.
- Don't use \`role="system"\` for assistant errors or warnings — reach for
  \`Alert\`/\`Callout\` inside the bubble, or a dedicated status row, since
  system rows intentionally strip almost all chrome.
- Don't put interactive form controls inside \`children\` expecting them to
  align with the bubble edge — the bubble's \`max-width\` is tuned for prose
  (640px cap), not for embedding wide widgets.

**Accessibility** — The component renders a plain \`<div>\` per message; it
does not itself assign \`role="log"\`/\`aria-live\` — that's \`MessageList\`'s
job at the container level (announcing new turns), since a single row has
no meaningful live-region semantics on its own. \`actions\` are reveal-on-hover
*and* reveal-on-\`focus-within\`, so keyboard users can still reach them
without a pointer; make sure any control passed into \`actions\` has its own
accessible name (icon-only buttons need \`aria-label\`). Timestamps render as
plain text — pass a real \`<time dateTime>\` element if the app needs a
machine-readable timestamp.

**Relevant tokens** — \`--surface-2\` (assistant bubble), \`--accent\`/\`--accent-ink\`
(user bubble), \`--ink\`, \`--muted\` (system text), \`--faint\` (meta row),
\`--rounded-lg\`/\`--rounded-sm\` (bubble corners, with the "tail" corner
flattened toward the avatar), \`--s-1\`…\`--s-4\` spacing scale.
        `,
      },
    },
  },
  args: {
    role: "assistant",
    children: "Here's a quick summary of the changes in this diff.",
  },
  argTypes: {
    role: {
      control: "radio",
      options: ["user", "assistant", "system"],
    },
  },
} satisfies Meta<typeof ChatMessage>

export default meta

type Story = StoryObj<typeof meta>

export const Assistant: Story = {
  args: {
    role: "assistant",
    avatar: <Avatar fallback="AI" size="md" />,
    timestamp: "10:02 AM",
    children: "Here's a quick summary of the changes in this diff.",
  },
}

export const User: Story = {
  args: {
    role: "user",
    avatar: <Avatar fallback="GB" size="md" />,
    timestamp: "10:01 AM",
    children: "Can you summarize what changed in this diff?",
  },
}

export const System: Story = {
  args: {
    role: "system",
    children: "Gustavo joined the conversation.",
  },
}

export const WithActions: Story = {
  args: {
    role: "assistant",
    avatar: <Avatar fallback="AI" size="md" />,
    timestamp: "10:02 AM",
    children: "Here's a quick summary of the changes in this diff.",
    actions: (
      <>
        <Button variant="ghost">Copy</Button>
        <Button variant="ghost">Retry</Button>
      </>
    ),
  },
  parameters: {
    docs: {
      description: {
        story: "Actions reveal on hover or keyboard focus-within — tab into the row to see them without a pointer.",
      },
    },
  },
}

export const LongContent: Story = {
  args: {
    role: "assistant",
    avatar: <Avatar fallback="AI" size="md" />,
    timestamp: "10:03 AM",
    children:
      "This message is intentionally long to demonstrate the bubble's max-width cap and word-wrapping behavior: it should wrap at roughly 640px (or 80% of the container, whichever is smaller) rather than stretching edge-to-edge, keeping conversational prose at a comfortable reading measure even in a wide viewport.",
  },
}

export const Conversation: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-4)" }}>
      <ChatMessage role="system">Conversation started</ChatMessage>
      <ChatMessage role="user" avatar={<Avatar fallback="GB" size="md" />} timestamp="10:01 AM">
        Can you summarize what changed in this diff?
      </ChatMessage>
      <ChatMessage role="assistant" avatar={<Avatar fallback="AI" size="md" />} timestamp="10:02 AM">
        Here's a quick summary of the changes in this diff.
      </ChatMessage>
    </div>
  ),
}
