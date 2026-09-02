import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { OutputBlock } from "./OutputBlock"

const LINES = Array.from({ length: 20 }, (_, i) => `linha ${i + 1}`).join("\n")

describe("OutputBlock", () => {
  it("renders the text verbatim, preserving whitespace", () => {
    const { container } = render(<OutputBlock text={"a\n  b"} />)
    expect(container.querySelector(".hds-out-body code")?.textContent).toBe("a\n  b")
  })

  it("clips past maxLines and reports how many are hidden", () => {
    render(<OutputBlock text={LINES} maxLines={5} moreLabel={(n) => `Mostrar mais ${n}`} />)
    expect(screen.getByRole("button", { name: "Mostrar mais 15" })).toBeInTheDocument()
    expect(screen.queryByText(/linha 20/)).not.toBeInTheDocument()
  })

  it("grows in place and offers to collapse again", async () => {
    const user = userEvent.setup()
    render(
      <OutputBlock
        text={LINES}
        maxLines={5}
        moreLabel={(n) => `Mostrar mais ${n}`}
        lessLabel="Mostrar menos"
      />
    )
    await user.click(screen.getByRole("button", { name: "Mostrar mais 15" }))
    expect(screen.getByText(/linha 20/)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Mostrar menos" }))
    expect(screen.queryByText(/linha 20/)).not.toBeInTheDocument()
  })

  it("offers no grow control without a moreLabel", () => {
    render(<OutputBlock text={LINES} maxLines={5} />)
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("copies the whole text, not the clipped excerpt", async () => {
    const user = userEvent.setup()
    const onCopy = vi.fn()
    render(<OutputBlock text={LINES} maxLines={3} onCopy={onCopy} copyLabel="Copiar" />)
    await user.click(screen.getByRole("button", { name: "Copiar" }))
    expect(onCopy).toHaveBeenCalledWith(LINES)
  })

  it("confirms a copy on the control itself", async () => {
    const user = userEvent.setup()
    render(<OutputBlock text="ok" onCopy={vi.fn()} copyLabel="Copiar" copiedLabel="Copiado" />)
    await user.click(screen.getByRole("button", { name: "Copiar" }))
    expect(screen.getByRole("button", { name: "Copiado" })).toBeInTheDocument()
  })

  it("disables copying when there is nothing to copy", () => {
    render(<OutputBlock text="" onCopy={vi.fn()} copyLabel="Copiar" emptyLabel="Sem saída" />)
    expect(screen.getByRole("button", { name: "Copiar" })).toBeDisabled()
  })

  it("says so when the output is empty instead of drawing an empty frame", () => {
    render(<OutputBlock text="" emptyLabel="Sem saída" />)
    expect(screen.getByText("Sem saída")).toBeInTheDocument()
  })

  it("marks the region busy while the result is still arriving", () => {
    const { container } = render(<OutputBlock text="" pending emptyLabel="Sem saída" />)
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(screen.queryByText("Sem saída")).not.toBeInTheDocument()
  })

  it("keeps the prompt glyph out of the accessible text", () => {
    const { container } = render(<OutputBlock text="npm run verify" prompt="$" />)
    expect(container.querySelector(".hds-out-prompt")).toHaveAttribute("aria-hidden", "true")
  })

  it("renders label, meta and note", () => {
    render(<OutputBlock text="x" label="Resultado" meta="20 linhas" note="cortado" />)
    expect(screen.getByText("Resultado")).toBeInTheDocument()
    expect(screen.getByText("20 linhas")).toBeInTheDocument()
    expect(screen.getByText("cortado")).toBeInTheDocument()
  })

  it("takes the danger tone for output that is the failure", () => {
    const { container } = render(<OutputBlock text="erro" tone="danger" />)
    expect(container.querySelector(".hds-out-danger")).not.toBeNull()
  })
})
