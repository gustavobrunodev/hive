import { useState } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
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

  it("multi-select mode sets aria-multiselectable and Ctrl-click toggles membership", () => {
    render(<Tree nodes={nodes} aria-label="Files" selection="multiple" defaultSelectedIds={["readme"]} />)
    expect(screen.getByRole("tree")).toHaveAttribute("aria-multiselectable", "true")
    expect(getItem("README.md")).toHaveAttribute("aria-selected", "true")

    // Ctrl-click on "locked.txt" is a no-op (disabled), so use another leaf:
    // exercise toggle-on via a second render-independent leaf isn't needed —
    // Ctrl-clicking the already-selected README.md toggles it off.
    fireEvent.click(screen.getByText("README.md"), { ctrlKey: true })
    expect(getItem("README.md")).toHaveAttribute("aria-selected", "false")
  })

  it("Space in multi-select mode replaces the selection (keyboard activation carries no toggle/range modifiers)", async () => {
    const user = userEvent.setup()
    render(<Tree nodes={nodes} aria-label="Files" selection="multiple" defaultSelectedIds={["src"]} />)
    getItem("README.md").focus()
    await user.keyboard(" ")
    expect(getItem("README.md")).toHaveAttribute("aria-selected", "true")
    expect(getItem("src")).toHaveAttribute("aria-selected", "false")
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

  describe("modifier-aware selection (multiple mode)", () => {
    it("plain click replaces selection with a single id, even when others were selected", async () => {
      const user = userEvent.setup()
      render(<Tree nodes={nodes} aria-label="Files" selection="multiple" defaultSelectedIds={["readme", "src"]} />)
      expect(getItem("README.md")).toHaveAttribute("aria-selected", "true")
      await user.click(screen.getByText("README.md"))
      expect(getItem("README.md")).toHaveAttribute("aria-selected", "true")
      expect(getItem("src")).toHaveAttribute("aria-selected", "false")
    })

    it("Ctrl-click toggles membership while keeping other selected items", () => {
      render(<Tree nodes={nodes} aria-label="Files" selection="multiple" defaultSelectedIds={["src"]} />)
      fireEvent.click(screen.getByText("README.md"), { ctrlKey: true })
      expect(getItem("src")).toHaveAttribute("aria-selected", "true")
      expect(getItem("README.md")).toHaveAttribute("aria-selected", "true")
    })

    it("Ctrl-click on an already-selected item removes just that item", () => {
      render(
        <Tree
          nodes={nodes}
          aria-label="Files"
          selection="multiple"
          defaultExpandedIds={["src"]}
          defaultSelectedIds={["index", "readme"]}
        />
      )
      fireEvent.click(screen.getByText("index.ts"), { ctrlKey: true })
      expect(getItem("index.ts")).toHaveAttribute("aria-selected", "false")
      expect(getItem("README.md")).toHaveAttribute("aria-selected", "true")
    })

    // Note: clicking a node with children only toggles expand/collapse (the
    // label sits inside the chevron <button>, which stops click propagation
    // before it reaches the row's onActivate) — this is pre-existing Tree
    // behavior, unchanged by T2. So these range tests anchor/target on leaf
    // rows, which is how the app's file rows in fact behave (only leaf/file
    // rows are ever mouse-selectable; directories are keyboard-selectable).
    // Visible order with src+components expanded: src, components, Button.tsx,
    // Input.tsx, index.ts, README.md.
    it("Shift-click selects the visible-order range from the anchor (forward)", () => {
      render(
        <Tree nodes={nodes} aria-label="Files" selection="multiple" defaultExpandedIds={["src", "components"]} />
      )
      // plain click on "Button.tsx" sets the anchor
      fireEvent.click(screen.getByText("Button.tsx"))
      // shift-click on "README.md" (later in visible order) selects the whole range
      fireEvent.click(screen.getByText("README.md"), { shiftKey: true })
      expect(getItem("Button.tsx")).toHaveAttribute("aria-selected", "true")
      expect(getItem("Input.tsx")).toHaveAttribute("aria-selected", "true")
      expect(getItem("index.ts")).toHaveAttribute("aria-selected", "true")
      expect(getItem("README.md")).toHaveAttribute("aria-selected", "true")
      expect(getItem("src")).toHaveAttribute("aria-selected", "false")
      expect(getItem("components")).toHaveAttribute("aria-selected", "false")
    })

    it("Shift-click selects the visible-order range from the anchor (backward)", () => {
      render(
        <Tree nodes={nodes} aria-label="Files" selection="multiple" defaultExpandedIds={["src", "components"]} />
      )
      // plain click on "index.ts" sets the anchor further down the visible list
      fireEvent.click(screen.getByText("index.ts"))
      // shift-click on "Input.tsx" (earlier in visible order) selects the range in between
      fireEvent.click(screen.getByText("Input.tsx"), { shiftKey: true })
      expect(getItem("Input.tsx")).toHaveAttribute("aria-selected", "true")
      expect(getItem("index.ts")).toHaveAttribute("aria-selected", "true")
      expect(getItem("Button.tsx")).toHaveAttribute("aria-selected", "false")
      expect(getItem("README.md")).toHaveAttribute("aria-selected", "false")
    })

    it("a subsequent shift-click re-anchors from the original anchor, not the previous range end", () => {
      render(
        <Tree nodes={nodes} aria-label="Files" selection="multiple" defaultExpandedIds={["src", "components"]} />
      )
      fireEvent.click(screen.getByText("Button.tsx"))
      fireEvent.click(screen.getByText("README.md"), { shiftKey: true })
      expect(getItem("Button.tsx")).toHaveAttribute("aria-selected", "true")
      expect(getItem("README.md")).toHaveAttribute("aria-selected", "true")
      // anchor is still "Button.tsx": shift-clicking back on it should collapse the range to just itself
      fireEvent.click(screen.getByText("Button.tsx"), { shiftKey: true })
      expect(getItem("Button.tsx")).toHaveAttribute("aria-selected", "true")
      expect(getItem("README.md")).toHaveAttribute("aria-selected", "false")
    })

    it("a parent row is selectable, and a plain click still expands it", () => {
      render(<Tree nodes={nodes} aria-label="Files" selection="multiple" />)
      fireEvent.click(screen.getByText("src"))
      expect(getItem("src")).toHaveAttribute("aria-selected", "true")
      expect(getItem("src")).toHaveAttribute("aria-expanded", "true")
    })

    it("Shift-click ONTO a parent row extends the range instead of collapsing it", () => {
      render(
        <Tree nodes={nodes} aria-label="Files" selection="multiple" defaultExpandedIds={["src"]} />
      )
      fireEvent.click(screen.getByText("README.md"))
      // Visible order: src, components, index.ts, README.md — so the range
      // back up to "components" (a parent) must cover the three rows between.
      fireEvent.click(screen.getByText("components"), { shiftKey: true })
      expect(getItem("components")).toHaveAttribute("aria-selected", "true")
      expect(getItem("index.ts")).toHaveAttribute("aria-selected", "true")
      expect(getItem("README.md")).toHaveAttribute("aria-selected", "true")
      expect(getItem("src")).toHaveAttribute("aria-selected", "false")
      // …and the modifier click must not have toggled the folder open, which
      // would have reordered the very list the range was measured over.
      expect(getItem("components")).toHaveAttribute("aria-expanded", "false")
    })

    it("a parent row can anchor a range (Shift-click FROM a folder)", () => {
      render(
        <Tree nodes={nodes} aria-label="Files" selection="multiple" defaultExpandedIds={["src"]} />
      )
      fireEvent.click(screen.getByText("components")) // selects AND expands
      fireEvent.click(screen.getByText("README.md"), { shiftKey: true })
      expect(getItem("components")).toHaveAttribute("aria-selected", "true")
      expect(getItem("Button.tsx")).toHaveAttribute("aria-selected", "true")
      expect(getItem("Input.tsx")).toHaveAttribute("aria-selected", "true")
      expect(getItem("index.ts")).toHaveAttribute("aria-selected", "true")
      expect(getItem("README.md")).toHaveAttribute("aria-selected", "true")
    })

    it("Ctrl-click adds a parent row to the selection without expanding it", () => {
      render(<Tree nodes={nodes} aria-label="Files" selection="multiple" />)
      fireEvent.click(screen.getByText("README.md"))
      fireEvent.click(screen.getByText("src"), { ctrlKey: true })
      expect(getItem("README.md")).toHaveAttribute("aria-selected", "true")
      expect(getItem("src")).toHaveAttribute("aria-selected", "true")
      expect(getItem("src")).toHaveAttribute("aria-expanded", "false")
    })

    it("Shift+ArrowDown/ArrowUp extends the range from the row focus is leaving", async () => {
      const user = userEvent.setup()
      render(
        <Tree nodes={nodes} aria-label="Files" selection="multiple" defaultExpandedIds={["src"]} />
      )
      // Visible order: src, components, index.ts, README.md (locked.txt is disabled).
      getItem("components").focus()
      await user.keyboard("{Shift>}{ArrowDown}{/Shift}")
      expect(getItem("components")).toHaveAttribute("aria-selected", "true")
      expect(getItem("index.ts")).toHaveAttribute("aria-selected", "true")
      await user.keyboard("{Shift>}{ArrowDown}{/Shift}")
      expect(getItem("README.md")).toHaveAttribute("aria-selected", "true")
      // Shrinking back up keeps the anchor where the walk started.
      await user.keyboard("{Shift>}{ArrowUp}{/Shift}")
      expect(getItem("README.md")).toHaveAttribute("aria-selected", "false")
      expect(getItem("components")).toHaveAttribute("aria-selected", "true")
    })

    it("a bare ArrowDown moves focus without touching the selection", async () => {
      const user = userEvent.setup()
      render(<Tree nodes={nodes} aria-label="Files" selection="multiple" />)
      getItem("src").focus()
      await user.keyboard("{ArrowDown}")
      expect(getItem("README.md")).toHaveFocus()
      expect(getItem("README.md")).toHaveAttribute("aria-selected", "false")
      expect(getItem("src")).toHaveAttribute("aria-selected", "false")
    })

    it("Enter/Space always pass toggle:false, range:false (single-item select, no range/toggle surprises)", async () => {
      const user = userEvent.setup()
      render(<Tree nodes={nodes} aria-label="Files" selection="multiple" defaultSelectedIds={["src"]} />)
      getItem("README.md").focus()
      await user.keyboard("{Enter}")
      expect(getItem("README.md")).toHaveAttribute("aria-selected", "true")
      expect(getItem("src")).toHaveAttribute("aria-selected", "false")
    })

    it("single-selection mode ignores Ctrl/Shift modifiers and always replaces the selection", () => {
      render(
        <Tree
          nodes={nodes}
          aria-label="Files"
          defaultExpandedIds={["src"]}
          defaultSelectedIds={["index"]}
        />
      )
      fireEvent.click(screen.getByText("README.md"), { ctrlKey: true })
      expect(getItem("README.md")).toHaveAttribute("aria-selected", "true")
      expect(getItem("index.ts")).toHaveAttribute("aria-selected", "false")

      fireEvent.click(screen.getByText("index.ts"), { shiftKey: true })
      expect(getItem("index.ts")).toHaveAttribute("aria-selected", "true")
      expect(getItem("README.md")).toHaveAttribute("aria-selected", "false")
    })
  })
})
