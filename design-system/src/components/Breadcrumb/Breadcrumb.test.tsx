import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { Breadcrumb } from "./Breadcrumb"

const items = [
  { label: "workspace", href: "/workspace" },
  { label: "src", href: "/workspace/src" },
  { label: "components", href: "/workspace/src/components" },
  { label: "Breadcrumb.tsx" },
]

describe("Breadcrumb", () => {
  it("renders a nav landmark with an ordered list of items", () => {
    render(<Breadcrumb items={items} />)
    const nav = screen.getByRole("navigation", { name: "Breadcrumb" })
    expect(nav).toBeInTheDocument()
    const list = within(nav).getByRole("list")
    expect(list.tagName).toBe("OL")
    expect(within(list).getAllByRole("listitem")).toHaveLength(items.length)
  })

  it("marks the last item as the current page and renders it as plain text", () => {
    render(<Breadcrumb items={items} />)
    const current = screen.getByText("Breadcrumb.tsx")
    expect(current).toHaveAttribute("aria-current", "page")
    expect(current.tagName).not.toBe("A")
    expect(current.tagName).not.toBe("BUTTON")
  })

  it("renders items with href as links and lets them be navigated", () => {
    render(<Breadcrumb items={items} />)
    const link = screen.getByRole("link", { name: "src" })
    expect(link).toHaveAttribute("href", "/workspace/src")
  })

  it("does not render an interactive element for the last item even if it has href/onClick", () => {
    const onClick = vi.fn()
    render(<Breadcrumb items={[...items.slice(0, 3), { label: "last", href: "/x", onClick }]} />)
    expect(screen.queryByRole("link", { name: "last" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "last" })).not.toBeInTheDocument()
    expect(screen.getByText("last")).toHaveAttribute("aria-current", "page")
  })

  it("renders items with onClick as buttons and fires the callback", async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Breadcrumb items={[{ label: "root", onClick }, { label: "current" }]} />)
    const button = screen.getByRole("button", { name: "root" })
    await user.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it("renders a middle item without href/onClick as plain, non-interactive text", () => {
    render(<Breadcrumb items={[{ label: "a", href: "/a" }, { label: "plain" }, { label: "c", href: "/c" }]} />)
    const plain = screen.getByText("plain")
    expect(plain.tagName).toBe("SPAN")
  })

  it("collapses the middle into a single ellipsis segment when items exceed maxItems", () => {
    render(<Breadcrumb items={items} maxItems={3} />)
    const nav = screen.getByRole("navigation", { name: "Breadcrumb" })
    const list = within(nav).getByRole("list")
    // first item + ellipsis + last item = 3 rendered <li>s, down from 4
    expect(within(list).getAllByRole("listitem")).toHaveLength(3)
    expect(screen.getByText("…")).toBeInTheDocument()
    expect(screen.getByText("workspace")).toBeInTheDocument()
    expect(screen.getByText("Breadcrumb.tsx")).toBeInTheDocument()
    expect(screen.queryByText("src")).not.toBeInTheDocument()
    expect(screen.queryByText("components")).not.toBeInTheDocument()
  })

  it("does not collapse when items.length is within maxItems", () => {
    render(<Breadcrumb items={items} maxItems={items.length} />)
    const nav = screen.getByRole("navigation", { name: "Breadcrumb" })
    const list = within(nav).getByRole("list")
    expect(within(list).getAllByRole("listitem")).toHaveLength(items.length)
    expect(screen.queryByText("…")).not.toBeInTheDocument()
  })

  it("does not collapse when maxItems is not provided", () => {
    render(<Breadcrumb items={items} />)
    const nav = screen.getByRole("navigation", { name: "Breadcrumb" })
    const list = within(nav).getByRole("list")
    expect(within(list).getAllByRole("listitem")).toHaveLength(items.length)
  })

  it("expands the tail as maxItems grows while still collapsing the middle", () => {
    const deep = [
      { label: "a", href: "/a" },
      { label: "b", href: "/b" },
      { label: "c", href: "/c" },
      { label: "d", href: "/d" },
      { label: "e", href: "/e" },
      { label: "f" },
    ]
    render(<Breadcrumb items={deep} maxItems={4} />)
    // first + ellipsis + last 2 = 4 rendered <li>s
    expect(screen.getByText("a")).toBeInTheDocument()
    expect(screen.getByText("e")).toBeInTheDocument()
    expect(screen.getByText("f")).toBeInTheDocument()
    expect(screen.getByText("…")).toBeInTheDocument()
    expect(screen.queryByText("b")).not.toBeInTheDocument()
    expect(screen.queryByText("c")).not.toBeInTheDocument()
    expect(screen.queryByText("d")).not.toBeInTheDocument()
  })

  it("merges a custom className onto the nav element", () => {
    render(<Breadcrumb items={items} className="extra" />)
    const nav = screen.getByRole("navigation", { name: "Breadcrumb" })
    expect(nav).toHaveClass("hds-breadcrumb", "extra")
  })
})
