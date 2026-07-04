import type { Meta, StoryObj } from "@storybook/react"

import { Tree } from "./Tree"
import type { TreeNode } from "./Tree"

const USAGE = `
**When to use / when not** — Tree renders a real hierarchy the user needs to
browse, expand, and select within (file/folder explorers, nested category
pickers, org charts). Don't use it for a flat list — that's overhead for no
benefit — and don't use it for switching between top-level views, which is
\`Tabs\`/\`Nav\`'s job.

**Do's & Don'ts**
- Do pick \`selection="multiple"\` deliberately for checkbox-like membership
  (toggling on/off) versus the default \`"single"\` which replaces the whole
  selection on activate — they're not just a styling difference, the click
  semantics differ.
- Do supply a stable, unique \`id\` per node — it drives \`aria-selected\`
  membership, the roving-tabindex focus target, and React's list \`key\`.
- Do use \`renderLabel\` when a node needs more than plain text (an icon, a
  badge, secondary metadata) instead of embedding markup in \`label\` itself —
  it receives the resolved \`{ level, expanded, selected, hasChildren }\`
  state so the custom render can react to it.
- Don't mark a node \`disabled\` and expect its children to also be
  unreachable — \`disabled\` only removes *that* node from focus/selection;
  nested children stay independently interactive if the parent is expanded.

**A11y** — Implements the WAI-ARIA Tree View pattern directly (no Radix
primitive exists for trees): \`role="tree"\`/\`"treeitem"\`/\`"group"\`,
\`aria-expanded\`/\`aria-selected\`/\`aria-level\`, and a roving tabindex (only
the active node is in the Tab order). ArrowUp/ArrowDown move focus between
visible rows; ArrowRight expands a collapsed parent (or moves into its first
child if already expanded); ArrowLeft collapses an expanded parent (or moves
focus to the parent if already collapsed/a leaf); Home/End jump to the
first/last visible row; Enter/Space activates (select/toggle) the focused
node; typing a character jump-searches to the next node whose label starts
with it. Always pass \`aria-label\` or \`aria-labelledby\` on \`Tree\` itself so
the tree has an accessible name.

**Relevant tokens** — \`--surface-2\` (row hover), \`--selected-bg\`/\`--selected\`
(selected row), \`--faint\` (disabled row), \`--focus\` (focus ring),
\`--muted\` (chevron), \`--rounded-sm\`, \`--ease-quart\`.
`

const FILE_TREE: TreeNode[] = [
  {
    id: "src",
    label: "src",
    children: [
      {
        id: "components",
        label: "components",
        children: [
          { id: "tree-tsx", label: "Tree.tsx" },
          { id: "tree-css", label: "Tree.css" },
          { id: "tabs-tsx", label: "Tabs.tsx" },
        ],
      },
      { id: "index-ts", label: "index.ts" },
    ],
  },
  {
    id: "docs",
    label: "docs",
    children: [
      { id: "readme", label: "README.md" },
      { id: "archived", label: "archived.md", disabled: true },
    ],
  },
  { id: "package-json", label: "package.json" },
]

const meta = {
  title: "Navigation/Tree",
  component: Tree,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: { description: { component: USAGE } },
  },
} satisfies Meta<typeof Tree>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    "aria-label": "Project files",
    nodes: FILE_TREE,
    defaultExpandedIds: ["src"],
    defaultSelectedIds: ["tree-tsx"],
  },
}

export const AllCollapsed: Story = {
  name: "All collapsed (click a chevron to expand)",
  args: {
    "aria-label": "Project files, collapsed",
    nodes: FILE_TREE,
  },
}

export const AllExpanded: Story = {
  args: {
    "aria-label": "Project files, expanded",
    nodes: FILE_TREE,
    defaultExpandedIds: ["src", "components", "docs"],
  },
}

export const MultipleSelection: Story = {
  args: {
    "aria-label": "Project files, multi-select",
    nodes: FILE_TREE,
    selection: "multiple",
    defaultExpandedIds: ["src", "components"],
    defaultSelectedIds: ["tree-tsx", "tree-css"],
  },
}
