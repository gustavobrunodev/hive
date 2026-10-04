import React from "react"
import { render, screen } from "@testing-library/react"
import { CursorDoAgente } from "./CursorDoAgente"

describe("CursorDoAgente", () => {
  it("é decorativo, posicionado e com o nome", () => {
    const { container } = render(<CursorDoAgente nome="Claude" x={12} y={30} />)
    const cursor = container.firstChild as HTMLElement
    expect(cursor).toHaveAttribute("aria-hidden", "true")
    expect(cursor.style.transform).toBe("translate(12px, 30px)")
    expect(screen.getByText("Claude")).toBeInTheDocument()
    expect(cursor).not.toHaveClass("dst-cursor-agente--oculto")
  })

  it("some sem sair do DOM", () => {
    const { container } = render(<CursorDoAgente nome="Devin" visivel={false} />)
    expect(container.firstChild).toHaveClass("dst-cursor-agente--oculto")
    expect((container.firstChild as HTMLElement).style.transform).toBe("translate(0px, 0px)")
  })
})
