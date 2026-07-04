import type { Meta, StoryObj } from "@storybook/react"

import { withTooltipProvider } from "../../../.storybook/decorators"
import { Button } from "../Button/Button"
import { Tooltip, TooltipContent, TooltipTrigger } from "./Tooltip"

const meta = {
  title: "Overlays/Tooltip",
  component: Tooltip,
  tags: ["autodocs"],
  decorators: [withTooltipProvider],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
A small, non-interactive hint bubble describing a trigger — never a
container for interactive content or a substitute for a visible label.
Wraps Radix's \`Tooltip.Root\`; must render beneath a \`TooltipProvider\`
(mounted once per app — this story mounts it via the shared
\`withTooltipProvider\` decorator so every trigger below shares one hover/
focus delay clock instead of each restarting its own).

**When to use** — a short clarification for an icon-only button, a truncated
label, or a keyboard shortcut hint. **When not** — anything the user needs
to act on (use \`Popover\` — Tooltip content is never focusable) or anything
critical to completing a task (a tooltip that only shows on hover/focus is
invisible to touch input, so essential info can't live there exclusively).

**Do's**
- Trigger only from a real focusable element (\`TooltipTrigger\` renders a
  \`<button>\` by default, or wrap an existing focusable element with
  \`asChild\`) — Radix wires both hover **and** keyboard focus to show it, so
  keyboard-only users get the same information as mouse users.
- Keep content to a single short phrase; anything longer belongs in
  \`Popover\` or inline copy.

**Don'ts**
- Don't put interactive elements (buttons, links) inside \`TooltipContent\` —
  it's dismissed the moment focus/hover leaves the trigger, so nothing
  inside is reliably reachable.
- Don't rely on a tooltip as the *only* way to learn what a control does;
  icon-only buttons still need an accessible name (\`aria-label\`) independent
  of the tooltip text.

**A11y** — Radix wires \`role="tooltip"\` and \`aria-describedby\` on the
trigger automatically, shows on both pointer hover and keyboard focus (this
story demonstrates both: click to focus the trigger, or hover it), and
positions with collision avoidance on by default. \`TooltipProvider\`'s
\`delayDuration\`/\`skipDelayDuration\` (350ms/300ms here, tuned down from
Radix's 700ms default to feel responsive in a keyboard-heavy desktop app)
apply to every Tooltip beneath it.

**Relevant tokens** — \`--ink\`/\`--bg\` (inverted surface — a deliberate
contrast from Popover's same-surface treatment), \`--shadow-1\`,
\`--z-tooltip\` (top of the shared z-index scale), \`--rounded-sm\`.
        `,
      },
    },
  },
} satisfies Meta<typeof Tooltip>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost">Hover or focus me</Button>
      </TooltipTrigger>
      <TooltipContent>Saves the current file</TooltipContent>
    </Tooltip>
  ),
}

/** Icon-only triggers still need their own `aria-label` — the tooltip is a hint, not the accessible name. */
export const IconTrigger: Story = {
  render: () => (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="Delete file"
          style={{
            width: 36,
            height: 36,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "var(--rounded-sm)",
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--danger-ink)",
            cursor: "pointer",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M3 4h10M6.5 4V2.5h3V4M4.5 4l.5 9.5h6l.5-9.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </TooltipTrigger>
      <TooltipContent>Delete file</TooltipContent>
    </Tooltip>
  ),
}
