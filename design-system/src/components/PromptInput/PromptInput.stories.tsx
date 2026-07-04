import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react"

import { PromptInput } from "./PromptInput"
import { Attachment } from "../Attachment/Attachment"

function AttachIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M11.5 5.5l-5 5a2 2 0 102.83 2.83l5-5a3.5 3.5 0 10-4.95-4.95l-5 5a5 5 0 007.07 7.07"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ToolbarButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 28,
        background: "transparent",
        color: "var(--muted)",
        border: 0,
        borderRadius: "var(--rounded-sm)",
        cursor: "pointer",
      }}
      onClick={() => alert(`${label} clicked`)}
    >
      <AttachIcon />
    </button>
  )
}

const meta = {
  title: "AI Chat/PromptInput",
  component: PromptInput,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: `
The chat composer — an auto-resizing \`Textarea\` plus a toolbar row with a
send control, an optional attachments slot above the field, and an optional
extra-toolbar slot (e.g. an attach-file trigger). Enter submits, Shift+Enter
inserts a newline (the same fixed convention \`Textarea\`'s
\`submitOnEnter\` documents). Generic per D4: it owns none of the transport —
the app supplies \`onSubmit\` and renders \`attachments\` as already-built
\`Attachment\` chips.

**When to use / when not** — Use \`PromptInput\` as the single composer at the
bottom of a \`MessageList\`. Don't use it for a one-shot search box or a
settings-form textarea — its send-button/streaming/attachments vocabulary is
specifically a chat composer's; a plain \`Textarea\` (or \`Input\`) is the right
primitive for a non-conversational field.

**Do's & Don'ts**
- Do distinguish \`disabled\` from \`streaming\`: \`disabled\` freezes the whole
  composer (textarea included — e.g. no active conversation yet), while
  \`streaming\` only disables the send control, so a user can keep typing their
  next message while the assistant is still responding to the last one.
- Do treat \`onSubmit\` as the single source of truth for what "submitted"
  means — in uncontrolled mode (no \`value\` prop) the component clears its own
  text after calling it; in controlled mode (\`value\`+\`onChange\`) it does not
  touch \`value\` at all, so the app must clear it itself if that's the desired
  behavior (see the Controlled story).
- Do pass already-rendered \`Attachment\` chips into \`attachments\` — this
  component only lays them out (a wrapping flex row above the field); it has
  no upload/file-picker logic of its own.
- Don't rely on \`onSubmit\` firing for whitespace-only input — the component
  trims the value and treats an empty/whitespace-only result as "nothing to
  send," disabling the send control the same way it does for a truly empty
  field.
- Don't override \`submitOnEnter\`-style behavior yourself by intercepting
  keydown on the rendered \`<textarea>\` — the Enter/Shift+Enter split is fixed
  inside \`Textarea\` (the DS's single convention for "send" vs "newline");
  layering another handler on top risks double-submits.

**Accessibility** — The send button is icon-only and always carries an
\`aria-label\` (\`sendLabel\`, default \`"Send"\`); it's a real, focusable
\`<button>\` that reflects its disabled state via the native \`disabled\`
attribute (empty text, \`disabled\`, or \`streaming\` all disable it, so
assistive tech announces "dimmed"/unavailable the same way for all three
causes). The textarea itself is a plain, labelable \`<textarea>\` — pair it
with a visually-hidden \`<label>\` or \`aria-label\` at the call site if the
surrounding layout doesn't already make its purpose obvious. Focus never
moves automatically on submit (no unexpected focus theft), and the
focus-within border highlight (\`:focus-within\` on the outer chrome) gives a
visible affordance without adding a redundant focus ring around the whole
composer.

**Relevant tokens** — \`--surface\`/\`--border\` (composer chrome),
\`--focus\` (focus-within border + button focus ring), \`--accent\`/
\`--accent-hover\`/\`--accent-ink\` (send button, enabled), \`--surface-3\`/
\`--faint\` (send button, disabled), \`--surface-2\` (whole composer when
\`disabled\`), \`--s-1\`…\`--s-3\` spacing.
        `,
      },
    },
  },
  args: {
    placeholder: "Message...",
  },
  argTypes: {
    disabled: { control: "boolean" },
    streaming: { control: "boolean" },
  },
} satisfies Meta<typeof PromptInput>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    onSubmit: (value: string) => alert(`Submitted: ${value}`),
  },
}

export const WithText: Story = {
  args: {
    defaultValue: "What changed in the last release?",
    onSubmit: (value: string) => alert(`Submitted: ${value}`),
  },
}

export const Streaming: Story = {
  args: {
    defaultValue: "Can you also check the other file?",
    streaming: true,
    onSubmit: (value: string) => alert(`Submitted: ${value}`),
  },
  parameters: {
    docs: {
      description: {
        story: "Send is disabled while the assistant is still responding, but the textarea itself stays editable — the user can queue up their next message.",
      },
    },
  },
}

export const Disabled: Story = {
  args: {
    disabled: true,
    defaultValue: "No active conversation",
    onSubmit: () => {},
  },
}

export const WithAttachments: Story = {
  args: {
    defaultValue: "Here's the file you asked for.",
    attachments: (
      <>
        <Attachment name="design.png" meta="2.1 MB" onRemove={() => {}} />
        <Attachment name="notes.txt" meta="4 KB" onRemove={() => {}} />
      </>
    ),
    onSubmit: (value: string) => alert(`Submitted: ${value}`),
  },
}

export const WithToolbar: Story = {
  args: {
    onSubmit: (value: string) => alert(`Submitted: ${value}`),
    toolbar: <ToolbarButton label="Attach file" />,
  },
}

/**
 * A fully working, controlled composer — types, submits on Enter or the
 * send button, and clears itself in response to a successful submit (the
 * app's own responsibility in controlled mode, per the Do's & Don'ts above).
 */
export const Controlled: Story = {
  args: {
    onSubmit: () => {},
  },
  render: (args) => {
    function Demo() {
      const [value, setValue] = useState("")
      const [sent, setSent] = useState<string[]>([])
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)", width: 420 }}>
          {sent.length > 0 && (
            <ul style={{ margin: 0, padding: 0, listStyle: "none", color: "var(--muted)", fontSize: "0.8125rem" }}>
              {sent.map((message, i) => (
                <li key={i}>Sent: {message}</li>
              ))}
            </ul>
          )}
          <PromptInput
            {...args}
            value={value}
            onChange={setValue}
            onSubmit={(submitted) => {
              setSent((prev) => [...prev, submitted])
              setValue("")
            }}
          />
        </div>
      )
    }
    return <Demo />
  },
}
