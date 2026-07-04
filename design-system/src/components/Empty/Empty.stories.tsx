import type { Meta, StoryObj } from "@storybook/react"

import { Button } from "../Button/Button"
import { Empty } from "./Empty"

function FolderIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M2 5.5C2 4.67 2.67 4 3.5 4h4l1.5 2h6.5c.83 0 1.5.67 1.5 1.5v7c0 .83-.67 1.5-1.5 1.5h-12C2.67 16 2 15.33 2 14.5v-9z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const meta = {
  title: "Feedback/Empty",
  component: Empty,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: `
A centered placeholder for a surface with no content — an empty file tree,
an empty chat, no search results — that teaches instead of rendering a blank
area.

**When to use / when not:** use Empty for a whole-surface zero-state (a panel,
a page section, a list) where there is genuinely nothing to show yet. Don't
use it for a transient loading gap — that's **Skeleton**'s job; Empty is the
*resolved* state ("we checked, there's nothing here"), not a placeholder for
content still arriving.

**Do's & Don'ts**
- Do always supply a concrete \`title\` — it's a required prop precisely so an empty state can't regress to a bare "Nothing here."
- Do use \`description\` to explain *why* it's empty or *what* would fill it (a filtered-out result vs a genuinely new workspace need different copy), not to restate the title.
- Do pass a \`Button\` (or similar) as \`action\` when there's a next step the user can take from right here (create the first item, clear the filter); omit it when there truly isn't one (e.g. a read-only search-results view).
- Don't overload the \`icon\` slot with a large illustration — it's styled at a small 20px box (\`--faint\` tone), matching the product register's quiet, non-decorative register rather than a marketing empty-state graphic.

**Accessibility:** renders as plain content in normal document flow — no
special role is needed since it's static, already-in-the-tree text, the same
reasoning Alert uses for its default no-\`role\` stance. The \`icon\` is
\`aria-hidden\` since \`title\`/\`description\` already carry the meaning.

**Tokens:** \`--faint\` for the icon, \`--ink\` for the title, \`--muted\` for the
description, \`--s-9\`/\`--s-6\` for the generous centered padding that gives an
empty surface breathing room instead of feeling broken.
        `,
      },
    },
  },
  args: {
    title: "No results found",
    description: "Try a different search term or clear your filters.",
  },
} satisfies Meta<typeof Empty>

export default meta

type Story = StoryObj<typeof meta>

export const WithAction: Story = {
  args: {
    icon: <FolderIcon />,
    title: "This workspace is empty",
    description: "Add your first file to get started.",
    action: <Button>Create a file</Button>,
  },
}

export const WithoutAction: Story = {
  args: {
    icon: <FolderIcon />,
    title: "No results found",
    description: "Try a different search term or clear your filters.",
  },
}

export const TitleOnly: Story = {
  args: {
    title: "Nothing to show yet",
    description: undefined,
  },
}
