import type { Meta, StoryObj } from "@storybook/react"

import { withFixedHeight } from "../../../.storybook/decorators"
import { Resizable, ResizableHandle, ResizablePanel } from "./Resizable"

function PaneContent({ label }: { label: string }) {
  return (
    <div style={{ padding: 16, height: "100%", boxSizing: "border-box" }}>
      <strong>{label}</strong>
    </div>
  )
}

const meta = {
  title: "Layout/Resizable",
  component: Resizable,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: `
A resizable pane group — a thin DS wrapper over \`react-resizable-panels\`'
\`Group\`/\`Panel\`/\`Separator\` (installed v4.12's actual export names; an
older major used \`PanelGroup\`/\`Panel\`/\`PanelResizeHandle\` instead — see
\`STATE.md\`'s Lessons). The library owns layout mechanics and the handle's
full WAI-ARIA separator semantics; this layer only supplies tokenized visual
styling on top.

**When to use / when not** — Use \`Resizable\` for a persistent split the user
actively controls (a chat pane against a file tree, an editor against a
preview). Don't use it for a one-off collapsible section — \`Accordion\` or a
simple disclosure is the right shape there; \`Resizable\` implies the split
itself is a durable layout decision the user makes once per session (or
persists via \`onLayoutChanged\`).

**Do's & Don'ts**
- Do give every \`ResizablePanel\` a stable \`id\` when persisting layout — the
  library associates saved percentages back to panels by \`id\`, not by
  render order.
- Do set \`minSize\`/\`maxSize\` on panels that must not collapse into
  unreadable slivers (e.g. a file tree that becomes useless below ~15%).
- Do render a \`ResizableHandle\` between every pair of panels — it's not just
  a drag affordance, it's what makes the split keyboard-operable at all
  (arrow keys, Home, End, Enter to reset).
- Don't nest a \`Resizable\` group's panel content directly as the flex/scroll
  owner — panels already set \`overflow: auto\`/\`min-height: 0\`; wrap deeper
  scrolling content in its own \`ScrollArea\` instead of fighting the panel's
  own overflow.

**A11y** — The handle renders \`role="separator"\` with \`aria-orientation\`,
\`aria-valuenow\`/\`aria-valuemin\`/\`aria-valuemax\` natively (no ARIA is added by
this wrapper — react-resizable-panels supplies the full set). It's
keyboard-focusable and resizes via arrow keys, Home (collapse toward start),
End (collapse toward end), and Enter (reset to default size). \`withGrip\`
adds a purely decorative three-dot affordance (\`aria-hidden\`) so sighted
users can see where to grab; it carries no semantics of its own.

**Relevant tokens** — \`--border\` (handle line), \`--accent\` (hover/active
handle), \`--focus\` (focus-visible handle), \`--surface-2\`/\`--muted\` (grip).

**Validated live**: this component's drag-resize and keyboard-resize
codepaths depend on real layout geometry that jsdom does not provide (see
\`.specs/codebase/CONCERNS.md\`) — Storybook + a real browser is the actual
proof that both work; the unit test suite deliberately stops at focus/ARIA/
prop-forwarding for this reason.
`,
      },
    },
  },
} satisfies Meta<typeof Resizable>

export default meta

type Story = StoryObj<typeof meta>

/** Two-panel horizontal split — the primary desktop-app shape (file tree | chat). */
export const TwoPanelHorizontal: Story = {
  decorators: [withFixedHeight(280)],
  args: {
    "aria-label": "Workspace",
  },
  render: (args) => (
    <Resizable {...args}>
      <ResizablePanel id="left" defaultSize={30} minSize={15} maxSize={70}>
        <PaneContent label="File tree" />
      </ResizablePanel>
      <ResizableHandle aria-label="Resize panels" />
      <ResizablePanel id="right" defaultSize={70}>
        <PaneContent label="Chat" />
      </ResizablePanel>
    </Resizable>
  ),
}

/** Vertical group orientation — stacked panes (e.g. an editor above a terminal/output pane). */
export const TwoPanelVertical: Story = {
  decorators: [withFixedHeight(320)],
  args: {
    orientation: "vertical",
    "aria-label": "Editor and output",
  },
  render: (args) => (
    <Resizable {...args}>
      <ResizablePanel id="top" defaultSize={65} minSize={20}>
        <PaneContent label="Editor" />
      </ResizablePanel>
      <ResizableHandle aria-label="Resize panels" />
      <ResizablePanel id="bottom" defaultSize={35} minSize={15}>
        <PaneContent label="Output" />
      </ResizablePanel>
    </Resizable>
  ),
}

/** `withGrip` renders a small three-dot grip inside the handle's hit area. */
export const WithGripHandle: Story = {
  decorators: [withFixedHeight(280)],
  args: {
    "aria-label": "Workspace",
  },
  render: (args) => (
    <Resizable {...args}>
      <ResizablePanel id="left" defaultSize={40} minSize={15}>
        <PaneContent label="Sidebar" />
      </ResizablePanel>
      <ResizableHandle aria-label="Resize panels" withGrip />
      <ResizablePanel id="right" defaultSize={60}>
        <PaneContent label="Content" />
      </ResizablePanel>
    </Resizable>
  ),
}

/** Three panels in one group — the handle between each adjacent pair resizes only its two neighbors. */
export const ThreePanels: Story = {
  decorators: [withFixedHeight(280)],
  args: {
    "aria-label": "Three-pane workspace",
  },
  render: (args) => (
    <Resizable {...args}>
      <ResizablePanel id="a" defaultSize={25} minSize={10}>
        <PaneContent label="A" />
      </ResizablePanel>
      <ResizableHandle aria-label="Resize A and B" />
      <ResizablePanel id="b" defaultSize={50} minSize={10}>
        <PaneContent label="B" />
      </ResizablePanel>
      <ResizableHandle aria-label="Resize B and C" />
      <ResizablePanel id="c" defaultSize={25} minSize={10}>
        <PaneContent label="C" />
      </ResizablePanel>
    </Resizable>
  ),
}

/** A disabled handle: the panels remain visible but cannot be resized via drag or keyboard. */
export const DisabledHandle: Story = {
  decorators: [withFixedHeight(280)],
  args: {
    "aria-label": "Workspace",
  },
  render: (args) => (
    <Resizable {...args}>
      <ResizablePanel id="left" defaultSize={30}>
        <PaneContent label="Fixed sidebar" />
      </ResizablePanel>
      <ResizableHandle aria-label="Resize disabled" disabled />
      <ResizablePanel id="right" defaultSize={70}>
        <PaneContent label="Content" />
      </ResizablePanel>
    </Resizable>
  ),
}
