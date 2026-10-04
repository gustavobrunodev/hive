import React from "react"
import { render, screen, within } from "@testing-library/react"
import { CartaoDeRevisao } from "./CartaoDeRevisao"

describe("CartaoDeRevisao", () => {
  it("lista os achados com o nível de cada um", () => {
    render(
      <CartaoDeRevisao
        titulo="Revisão de usabilidade"
        achados={[
          { nivel: "resolvido", texto: "Status visível." },
          { nivel: "alto", texto: "IBAN tarde demais." },
          { nivel: "baixo", texto: "Ícone pequeno." },
        ]}
      />
    )
    const cartao = screen.getByRole("region", { name: "Revisão de usabilidade" })
    const itens = within(cartao).getAllByRole("listitem")
    expect(itens).toHaveLength(3)
    expect(itens[0]).toHaveTextContent("ResolvidoStatus visível.")
    expect(itens[1]).toHaveTextContent("AltoIBAN tarde demais.")
    expect(itens[2]).toHaveTextContent("BaixoÍcone pequeno.")
  })
})
