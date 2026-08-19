import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { Attachment } from "./Attachment"

describe("Attachment", () => {
  it("renders the name", () => {
    render(<Attachment name="design.png" />)
    expect(screen.getByText("design.png")).toBeInTheDocument()
  })

  it("renders optional meta text", () => {
    render(<Attachment name="design.png" meta="2.1 MB" />)
    expect(screen.getByText("2.1 MB")).toBeInTheDocument()
  })

  it("renders an optional icon slot", () => {
    render(<Attachment name="design.png" icon={<span data-testid="icon">📄</span>} />)
    expect(screen.getByTestId("icon")).toBeInTheDocument()
  })

  // Middle truncation: end-ellipsis eats the extension first, which is the
  // single most informative token in a file name.
  describe("truncate=\"middle\"", () => {
    it("keeps the extension in a tail that cannot shrink", () => {
      render(<Attachment name="relatorio-trimestral-consolidado-v3.docx" truncate="middle" />)
      const tail = document.querySelector(".hds-attachment-name-tail")
      expect(tail?.textContent).toBe("-v3.docx")
      // Head + tail still read as the one uninterrupted name — to a screen
      // reader, and to copy/paste.
      expect(document.querySelector(".hds-attachment-name")?.textContent).toBe(
        "relatorio-trimestral-consolidado-v3.docx"
      )
    })

    it("leaves a short name whole — there is nothing to truncate", () => {
      render(<Attachment name="notas.txt" truncate="middle" />)
      expect(document.querySelector(".hds-attachment-name-tail")).toBeNull()
      expect(screen.getByText("notas.txt")).toBeInTheDocument()
    })

    it("falls back to a character split for a name with no extension", () => {
      render(<Attachment name="arquivo-sem-extensao-nenhuma" truncate="middle" />)
      expect(document.querySelector(".hds-attachment-name-tail")?.textContent).toBe("uma")
    })

    it("splits nothing by default", () => {
      render(<Attachment name="relatorio-trimestral-consolidado-v3.docx" />)
      expect(document.querySelector(".hds-attachment-name-tail")).toBeNull()
    })
  })

  it("does not render a remove button when onRemove is omitted", () => {
    render(<Attachment name="design.png" />)
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("renders a remove button with a derived accessible label and fires onRemove", async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn()
    render(<Attachment name="design.png" onRemove={onRemove} />)

    const button = screen.getByRole("button", { name: "Remove design.png" })
    await user.click(button)
    expect(onRemove).toHaveBeenCalledTimes(1)
  })

  it("uses a fallback accessible label when name is not a string", async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn()
    render(<Attachment name={<em>design.png</em>} onRemove={onRemove} />)

    const button = screen.getByRole("button", { name: "Remove attachment" })
    await user.click(button)
    expect(onRemove).toHaveBeenCalledTimes(1)
  })

  it("accepts a custom removeLabel", () => {
    render(<Attachment name="design.png" onRemove={() => {}} removeLabel="Discard file" />)
    expect(screen.getByRole("button", { name: "Discard file" })).toBeInTheDocument()
  })

  it("merges a custom className", () => {
    const { container } = render(<Attachment name="design.png" className="extra" />)
    expect(container.firstChild).toHaveClass("hds-attachment", "extra")
  })

  it("forwards a ref to the root element", () => {
    let node: HTMLDivElement | null = null
    render(
      <Attachment
        name="design.png"
        ref={(el) => {
          node = el
        }}
      />
    )
    expect(node).not.toBeNull()
  })
})
