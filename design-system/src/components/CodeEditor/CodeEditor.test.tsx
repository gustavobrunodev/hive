import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createRef, useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { CodeEditor } from "./CodeEditor"

function Harness({ initial = "", filename = "a.ts" }: { initial?: string; filename?: string }) {
  const [value, setValue] = useState(initial)
  return (
    <CodeEditor value={value} onChange={setValue} filename={filename} ariaLabel="Conteúdo" />
  )
}

/** The painted layer — deliberately not reachable by role: it is a picture. */
function mirror(): HTMLElement {
  const node = document.querySelector(".hds-editor-mirror")
  if (node === null) throw new Error("mirror not rendered")
  return node as HTMLElement
}

/** One element per source line, in document order. */
function lines(): HTMLElement[] {
  return [...mirror().querySelectorAll<HTMLElement>(".hds-editor-line")]
}

describe("CodeEditor", () => {
  it("is a real textarea, named and editable", async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const field = screen.getByRole("textbox", { name: "Conteúdo" })
    await user.type(field, "const a = 1")
    expect(field).toHaveValue("const a = 1")
  })

  /**
   * The alignment contract, at the level a DOM test can hold it: whatever the
   * grammar did, the painted text must be the file. A mirror that is off by one
   * character is a mirror whose colours are on the wrong words.
   */
  it("paints exactly the source it was given, one block per line", () => {
    const source = "// nota\n\nconst a = { b: 'x' }\n"
    render(<Harness initial={source} />)
    // The newlines live in the block boundaries now, not in the text: joining
    // the lines back with them has to give the file, blank line and trailing
    // empty line included.
    expect(lines().map((line) => line.textContent).join("\n")).toBe(source)
  })

  it("colours by role, and keeps the roles out of the accessibility tree", () => {
    render(<Harness initial={"// nota\nconst a = 1\n"} />)
    const roles = [...mirror().querySelectorAll("[data-role]")].map((node) =>
      node.getAttribute("data-role")
    )
    expect(roles).toContain("comment")
    expect(roles).toContain("keyword")
    expect(mirror()).toHaveAttribute("aria-hidden", "true")
  })

  it("picks the grammar from the file name", () => {
    const { unmount } = render(<Harness initial={"a: 1\n"} filename="conf.yaml" />)
    expect(mirror().querySelector('[data-role="property"]')?.textContent).toBe("a")
    unmount()
    render(<Harness initial={"a: 1\n"} filename="notas" />)
    expect(mirror().querySelector("[data-role]")).toBeNull()
  })

  it("hands the caller its own scroll events", async () => {
    const onScroll = vi.fn()
    render(
      <CodeEditor
        value={"x\n".repeat(200)}
        onChange={() => {}}
        ariaLabel="Conteúdo"
        onScroll={onScroll}
      />
    )
    screen.getByRole("textbox").dispatchEvent(new Event("scroll", { bubbles: true }))
    expect(onScroll).toHaveBeenCalled()
  })

  it("marks the lines it is told to, and only those", () => {
    render(
      <CodeEditor
        value={"a\nb\nc"}
        onChange={() => {}}
        ariaLabel="Conteúdo"
        marks={["add", null, "deleted"]}
      />
    )
    expect(lines().map((line) => line.getAttribute("data-mark"))).toEqual([
      "add",
      null,
      "deleted",
    ])
  })

  /**
   * A stale array is the normal case, not an edge one: the marks are computed
   * off the keystroke path, so between a keypress and the next diff the file
   * has more lines than the caller has answers for. Those lines are unmarked,
   * never mis-marked.
   */
  it("leaves lines past the end of a stale mark array unmarked", () => {
    render(
      <CodeEditor value={"a\nb\nc"} onChange={() => {}} ariaLabel="Conteúdo" marks={["add"]} />
    )
    expect(lines()[2]?.hasAttribute("data-mark")).toBe(false)
  })

  it("follows the caret's line only while the field has focus", async () => {
    const user = userEvent.setup()
    render(<Harness initial={"um\ndois\ntrês"} />)
    const root = document.querySelector(".hds-editor") as HTMLElement
    expect(root.hasAttribute("data-focused")).toBe(false)

    const field = screen.getByRole("textbox") as HTMLTextAreaElement
    await user.click(field)
    expect(root).toHaveAttribute("data-focused")

    // "um\ndois\ntrês" — index 10 is inside the third line.
    field.setSelectionRange(10, 10)
    document.dispatchEvent(new Event("selectionchange"))
    expect(lines()[2]).toHaveAttribute("data-current")
    expect(lines()[0]?.hasAttribute("data-current")).toBe(false)
  })

  it("gives up the caret's row when the field does", async () => {
    const user = userEvent.setup()
    render(<Harness initial={"um\ndois"} />)
    const root = document.querySelector(".hds-editor") as HTMLElement
    const wash = document.querySelector(".hds-editor-wash") as HTMLElement

    await user.click(screen.getByRole("textbox"))
    expect(wash.hidden).toBe(false)

    await user.tab()
    expect(root.hasAttribute("data-focused")).toBe(false)
  })

  /** A read-only surface has no caret to follow, so it draws no row. */
  it("draws no current row when the caller turns it off", async () => {
    const user = userEvent.setup()
    render(
      <CodeEditor
        value={"um\ndois"}
        onChange={() => {}}
        ariaLabel="Conteúdo"
        currentLine={false}
        readOnly
      />
    )
    await user.click(screen.getByRole("textbox"))
    expect(document.querySelector(".hds-editor-wash")?.hasAttribute("hidden")).toBe(true)
    expect(document.querySelector("[data-current]")).toBeNull()
  })

  /**
   * The field itself is the ref, both ways a caller can ask for it: the app's
   * viewer reaches through this ref to place the caret when it swaps back from
   * the rendered preview, so a ref that stopped at the wrapper would break a
   * feature two packages away.
   */
  it("hands the caller the textarea, by object ref and by callback", () => {
    const object = createRef<HTMLTextAreaElement>()
    const { unmount } = render(
      <CodeEditor value="a" onChange={() => {}} ariaLabel="Conteúdo" ref={object} />
    )
    expect(object.current).toBe(screen.getByRole("textbox"))
    unmount()

    let seen: HTMLTextAreaElement | null = null
    render(
      <CodeEditor
        value="a"
        onChange={() => {}}
        ariaLabel="Conteúdo"
        ref={(node) => {
          seen = node
        }}
      />
    )
    expect(seen).toBe(screen.getByRole("textbox"))
  })

  it("numbers the lines unless told not to", () => {
    const { unmount } = render(<Harness initial={"a\nb"} />)
    expect(document.querySelector(".hds-editor")).toHaveAttribute("data-numbered")
    unmount()
    render(
      <CodeEditor value="a" onChange={() => {}} ariaLabel="Conteúdo" lineNumbers={false} />
    )
    expect(document.querySelector(".hds-editor")?.hasAttribute("data-numbered")).toBe(false)
  })
})
