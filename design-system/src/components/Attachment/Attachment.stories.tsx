import type { Meta, StoryObj } from "@storybook/react"

import { Attachment } from "./Attachment"

function FileIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M4 1.5h5.5L12.5 4.5V14a.5.5 0 01-.5.5H4a.5.5 0 01-.5-.5V2a.5.5 0 01.5-.5z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M9.5 1.5V4.5H12.5" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  )
}

const meta = {
  title: "AI Chat/Attachment",
  component: Attachment,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: `
A single file-attachment chip — name, optional meta text (size/type), an
optional leading icon, and an optional remove control. Built for
\`PromptInput\`'s \`attachments\` slot (spec.md's P3 AC4), but generic enough to
render inside a message bubble too (e.g. an assistant's previous turn
referencing an uploaded file) — it's a display primitive with a remove
callback, not something that owns upload/transport itself.

**When to use / when not** — Use \`Attachment\` for any single file/blob a user
attached or an assistant referenced, wherever the chat surface needs to show
"this turn has a file." Don't use it as a generic removable tag/pill outside
a file context — reach for \`Chip\` for that; \`Attachment\`'s two-line
name/meta layout and file-icon slot are specifically shaped for filenames,
not arbitrary short labels.

**Do's & Don'ts**
- Do omit \`onRemove\` for attachments the user can no longer retract (e.g. an
  attachment already sent, rendered back inside a past \`ChatMessage\`) — the
  component renders no remove control at all when \`onRemove\` is absent,
  rather than a disabled one.
- Do pass \`meta\` for anything that helps a user recognize the right file at a
  glance (size, extension, page count) — \`name\` and \`meta\` both truncate with
  an ellipsis past the chip's \`max-width: 220px\`, so don't rely on either
  being fully visible for very long strings.
- Do supply \`removeLabel\` when \`name\` is a non-string node (an icon, styled
  text) — the derived default falls back to the generic "Remove attachment"
  in that case, which is correct but less specific than a name-aware label.
- Don't stack more than a handful of \`Attachment\`s without a wrapping scroll
  or wrap container — the chip has no built-in overflow handling of its own;
  \`PromptInput\`'s attachments slot wraps them in a \`flex-wrap\` row.

**Accessibility** — The remove control is a real \`<button>\` with a derived
\`aria-label\` ("Remove {name}" when \`name\` is a string, else the
\`removeLabel\` override or a generic fallback) — icon-only buttons always need
an accessible name, and this component computes one so callers don't have to
remember to. The chip itself is a plain, non-interactive \`<div>\`; it carries
no implicit role, so if a consuming app needs the attachment list announced
as a group (e.g. "3 files attached"), that's the app's responsibility at the
container level, the same delegation \`ChatMessage\` uses for live-region
semantics.

**Relevant tokens** — \`--surface-2\` (chip background), \`--border\` (chip
border), \`--rounded-md\` (chip corners), \`--ink\`/\`--faint\`/\`--muted\` (name,
meta, and icon text respectively), \`--surface-3\` (remove-button hover),
\`--focus\` (remove-button focus ring).
        `,
      },
    },
  },
  args: {
    name: "design.png",
  },
} satisfies Meta<typeof Attachment>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    name: "design.png",
  },
}

export const WithMeta: Story = {
  args: {
    name: "design.png",
    meta: "2.1 MB",
  },
}

export const WithIcon: Story = {
  args: {
    name: "quarterly-report.pdf",
    meta: "480 KB",
    icon: <FileIcon />,
  },
}

export const Removable: Story = {
  args: {
    name: "design.png",
    meta: "2.1 MB",
    icon: <FileIcon />,
    onRemove: () => alert("Removed"),
  },
  parameters: {
    docs: {
      description: {
        story: "With `onRemove` supplied, a remove control renders with a derived accessible label (\"Remove design.png\").",
      },
    },
  },
}

export const LongFilename: Story = {
  name: "Long filename (truncates)",
  args: {
    name: "quarterly-financial-summary-with-appendices-final-v3.xlsx",
    meta: "1.8 MB — Microsoft Excel Worksheet",
    icon: <FileIcon />,
    onRemove: () => {},
  },
  parameters: {
    docs: {
      description: {
        story: "Both `name` and `meta` truncate with an ellipsis past the chip's 220px max-width rather than wrapping or overflowing.",
      },
    },
  },
}

export const Group: Story = {
  name: "Multiple (as in PromptInput's attachments slot)",
  render: () => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--s-2)" }}>
      <Attachment name="design.png" meta="2.1 MB" icon={<FileIcon />} onRemove={() => {}} />
      <Attachment name="notes.txt" meta="4 KB" icon={<FileIcon />} onRemove={() => {}} />
      <Attachment name="quarterly-report.pdf" meta="480 KB" icon={<FileIcon />} onRemove={() => {}} />
    </div>
  ),
}
