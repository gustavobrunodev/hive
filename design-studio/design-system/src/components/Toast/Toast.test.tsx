import React from "react"
import { render, screen } from "@testing-library/react"
import { Toast } from "./Toast"

describe("Toast", () => {
  it("anuncia o texto", () => {
    render(<Toast>Elemento inserido</Toast>)
    expect(screen.getByRole("status")).toHaveTextContent("Elemento inserido")
    expect(screen.getByRole("status")).not.toHaveClass("dst-toast--saindo")
  })

  it("esmaece ao sair", () => {
    render(<Toast saindo icone="info">Nada mudou</Toast>)
    expect(screen.getByRole("status")).toHaveClass("dst-toast--saindo")
  })
})
