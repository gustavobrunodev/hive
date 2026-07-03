import { useState } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { Tree } from "./Tree"
import type { TreeNode } from "./Tree"

const nodes: TreeNode[] = [
  {
    id: "src",
    label: "src",
    children: [
      {
        id: "components",
        label: "components",
        children: [
          { id: "button", label: "Button.tsx" },
          { id: "input", label: "Input.tsx" },
        ],
      },
      { id: "index", label: "index.ts" },
    ],
  },
  { id: "readme", label: "README.md" },
  { id: "locked", label: "locked.txt", disabled: true },
]

function getItem(name: string) {
  return screen.getByText(name).closest('[role="treeitem"]') as HTMLElement
}

describe("Tree", () => {
  it("renders role=tree with top-level items only, children collapsed by default", () => {
    render(<Tree nodes={nodes} aria-label="Files" />);
    expect(screen.getByRole("tree", { name: "Files" })).toBeInTheDocument()
    expect(screen.getByText("src")).toBeInTheDocument()
    expect(screen.getByText("README.md")).toBeInTheDocument()
    expect(screen.queryByText("components")).not.toBeInTheDocument()
  })

  it("defaultExpandedIds reveals nested items", () => {
    render(<Tree nodes={nodes} aria-label="Files" defaultExpandedIds={["src"]} />)
    expect(screen.getByText("components")).toBeInTheDocument()
    expect(screen.queryByText("Button.tsx")).not.toBeInTheDocument()
  })

  it("clicking the toggle expands and collapses a node", async () => {
    const user = userEvent.setup()
    render(<Tree nodes={nodes} aria-label="Files" />)
    const srcItem = getItem("src")
    expect(srcItem).toHaveAttribute("aria-expanded", "false")

    await user.click(screen.getByText("src"))
    expect(getItem("src")).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByText("components")).toBeInTheDocument()

    await user.click(screen.getByText("src"))
    expect(getItem("src")).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByText("components")).not.toBeInTheDocument()
  })

  it("ArrowRight expands a collapsed node with children", async () => {
    const user = userEvent.setup()
    render(<Tree nodes={nodes} aria-label="Files" />)
    getItem("src").focus()
    await user.keyboard("{ArrowRight}")
    expect(getItem("src")).toHaveAttribute("aria-expanded", "true")
  })

  it("ArrowRight on an already-expanded node moves focus to its first child", async () => {
    const user = userEvent.setup()
    render(<Tree nodes={nodes} aria-label="Files" defaultExpandedIds={["src"]} />)
    getItem("src").focus()
    await user.keyboard("{ArrowRight}")
    expect(getItem("components")).toHaveFocus()
  })

  it("ArrowRight on a leaf node does nothing", async () => {
    const user = userEvent.setup()
    render(<Tree nodes={nodes} aria-label="Files" />)
    getItem("README.md").focus()
    await user.keyboard("{ArrowRight}")
    expect(getItem("README.md")).toHaveFocus()
  })

  it("ArrowLeft collapses an expanded node", async () => {
    const user = userEvent.setup()
    render(<Tree nodes={nodes} aria-label="Files" defaultExpandedIds={["src"]} />)
    getItem("src").focus()
    await user.keyboard("{ArrowLeft}")
    expect(getItem("src")).toHaveAttribute("aria-expanded", "false")
  })

  it("ArrowLeft on a collapsed child moves focus to its parent", async () => {
    const user = userEvent.setup()
    render(<Tree nodes={nodes} aria-label="Files" defaultExpandedIds={["src"]} />)
    getItem("index.ts").focus()
    await user.keyboard("{ArrowLeft}")
    expect(getItem("src")).toHaveFocus()
  })

  it("ArrowDown/ArrowUp move roving tabindex focus between visible items", async () => {
    const user = userEvent.setup()
    render(<Tree nodes={nodes} aria-label="Files" />)
    getItem("src").focus()
    expect(getItem("src")).toHaveAttribute("tabIndex", "0")
    expect(getItem("README.md")).toHaveAttribute("tabIndex", "-1")

    await user.keyboard("{ArrowDown}")
    expect(getItem("README.md")).toHaveFocus()
    expect(getItem("README.md")).toHaveAttribute("tabIndex", "0")
    expect(getItem("src")).toHaveAttribute("tabIndex", "-1")

    await user.keyboard("{ArrowUp}")
    expect(getItem("src")).toHaveFocus()
  })

  it("Home/End jump to the first/last visible item", async () => {
    const user = userEvent.setup()
    render(<Tree nodes={nodes} aria-label="Files" defaultExpandedIds={["src"]} />)
    getItem("index.ts").focus()

    await user.keyboard("{Home}")
    expect(getItem("src")).toHaveFocus()

    // "locked.txt" is disabled, so End lands on the last *enabled* visible
    // item (README.md), not literally the last node in the tree.
    await user.keyboard("{End}")
    expect(getItem("README.md")).toHaveFocus()
  })

  it("Enter/Space selects in single mode, replacing the previous selection", async () => {
    const user = userEvent.setup()
    render(<Tree nodes={nodes} aria-label="Files" />)
    getItem("src").focus()
    await user.keyboard("{Enter}")
    expect(getItem("src")).toHaveAttribute("aria-selected", "true")

    await user.keyboard("{ArrowDown} ")
    expect(getItem("README.md")).toHaveAttribute("aria-selected", "true")
    expect(getItem("src")).toHaveAttribute("aria-selected", "false")
  })

  it("multi-select mode toggles membership and sets aria-multiselectable", async () => {
    const user = userEvent.setup()
    render(<Tree nodes={nodes} aria-label="Files" selection="multiple" />)
    expect(screen.getByRole("tree")).toHaveAttribute("aria-multiselectable", "true")

    getItem("src").focus()
    await user.keyboard(" ")
    await user.keyboard("{ArrowDown} ")
    expect(getItem("src")).toHaveAttribute("aria-selected", "true")
    expect(getItem("README.md")).toHaveAttribute("aria-selected", "true")

    // toggling src again should deselect it, leaving README.md selected
    getItem("src").focus()
    await user.keyboard(" ")
    expect(getItem("src")).toHaveAttribute("aria-selected", "false")
    expect(getItem("README.md")).toHaveAttribute("aria-selected", "true")
  })

  it("a disabled node is non-focusable, non-selectable, and skipped by arrow navigation", async () => {
    const user = userEvent.setup()
    render(<Tree nodes={nodes} aria-label="Files" />)
    expect(getItem("locked.txt")).not.toHaveAttribute("tabIndex")
    expect(getItem("locked.txt")).toHaveAttribute("aria-disabled", "true")

    getItem("README.md").focus()
    await user.keyboard("{ArrowDown}")
    // there is no enabled item after README.md (locked.txt is disabled), so
    // focus should stay put rather than move to the disabled node
    expect(getItem("README.md")).toHaveFocus()
  })

  it("type-ahead jumps to the next item whose string label starts with the typed character", async () => {
    const user = userEvent.setup()
    render(<Tree nodes={nodes} aria-label="Files" />)
    getItem("src").focus()
    await user.keyboard("r")
    expect(getItem("README.md")).toHaveFocus()
  })

  it("type-ahead wraps around to the top when no match exists after the current item", async () => {
    const user = userEvent.setup()
    render(<Tree nodes={nodes} aria-label="Files" />)
    // "README.md" is the last visible item starting with a letter after
    // "src" alphabetically among siblings; from there, typing "s" (matching
    // "src", which sorts *before* README.md in the list) must wrap around
    // to the top of the list rather than finding nothing.
    getItem("README.md").focus()
    await user.keyboard("s")
    expect(getItem("src")).toHaveFocus()
  })

  it("supports controlled selectedIds/expandedIds with onChange callbacks", async () => {
    const user = userEvent.setup()
    function Controlled() {
      const [selected, setSelected] = useState<string[]>([])
      const [expanded, setExpanded] = useState<string[]>([])
      return (
        <Tree
          nodes={nodes}
          aria-label="Files"
          selectedIds={selected}
          onSelectedIdsChange={setSelected}
          expandedIds={expanded}
          onExpandedIdsChange={setExpanded}
        />
      )
    }
    render(<Controlled />)
    await user.click(screen.getByText("src"))
    expect(getItem("src")).toHaveAttribute("aria-expanded", "true")
    await user.click(screen.getByText("README.md"))
    expect(getItem("README.md")).toHaveAttribute("aria-selected", "true")
  })

  it("uses a custom renderLabel when provided", () => {
    render(
      <Tree
        nodes={nodes}
        aria-label="Files"
        renderLabel={(node) => <span data-testid={`custom-${node.id}`}>{node.label}</span>}
      />
    )
    expect(screen.getByTestId("custom-src")).toBeInTheDocument()
  })

  it("clicking a leaf item selects it without affecting any expand state", async () => {
    const user = userEvent.setup()
    const onExpandedIdsChange = vi.fn()
    render(<Tree nodes={nodes} aria-label="Files" onExpandedIdsChange={onExpandedIdsChange} />)
    await user.click(screen.getByText("README.md"))
    expect(getItem("README.md")).toHaveAttribute("aria-selected", "true")
    expect(onExpandedIdsChange).not.toHaveBeenCalled()
  })

  it("merges a custom className", () => {
    render(<Tree nodes={nodes} aria-label="Files" className="extra" />)
    expect(screen.getByRole("tree")).toHaveClass("hds-tree", "extra")
  })
})
