import React from "react"
import { render, screen } from "@testing-library/react"
import { BarraDeProgresso } from "./BarraDeProgresso"

describe("BarraDeProgresso", () => {
  it("expõe o valor em porcentagem", () => {
    const { container } = render(<BarraDeProgresso valor={1 / 3} rotulo="Variantes" />)
    const barra = screen.getByRole("progressbar", { name: "Variantes" })
    expect(barra).toHaveAttribute("aria-valuenow", "33")
    expect((container.querySelector("i") as HTMLElement).style.width).toBe("33%")
  })

  it("limita valores fora de 0 a 1", () => {
    const { rerender } = render(<BarraDeProgresso valor={2} rotulo="x" />)
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100")
    rerender(<BarraDeProgresso valor={-1} rotulo="x" />)
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0")
  })
})
