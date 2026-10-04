import React from "react"
import { render, screen } from "@testing-library/react"
import { SeloExemplo } from "./SeloExemplo"

describe("SeloExemplo", () => {
  it("diz Dados de exemplo em pill por padrão", () => {
    render(<SeloExemplo />)
    expect(screen.getByText("Dados de exemplo")).toHaveClass("dst-selo-exemplo--pill")
  })

  it("linha e texto próprio", () => {
    render(<SeloExemplo forma="linha" texto="Exemplo" />)
    expect(screen.getByText("Exemplo")).toHaveClass("dst-selo-exemplo--linha")
  })
})
