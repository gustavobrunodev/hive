import type { Meta, StoryObj } from "@storybook/react"
import React, { useState } from "react"
import leia from "./README.md?raw"
import { Fileira } from "../../stories/ajudantes"
import { Segmentado } from "./Segmentado"

const meta = {
  title: "Seleção/Segmentado",
  component: Segmentado,
  tags: ["autodocs"],
  parameters: { docs: { description: { component: leia } }, claudeDesign: { altura: 80 } },
} satisfies Meta<typeof Segmentado>

export default meta
type Story = StoryObj<typeof meta>

function Produto() {
  const [v, setV] = useState("cambio")
  return <Segmentado rotulo="Produto" valor={v} aoMudar={setV} opcoes={[{ valor: "cambio", rotulo: "Câmbio" }, { valor: "extrato", rotulo: "Extrato" }, { valor: "pix", rotulo: "Pix" }]} />
}
function Tema() {
  const [v, setV] = useState("claro")
  return <Segmentado forma="pill" rotulo="Tema" valor={v} aoMudar={setV} opcoes={[{ valor: "claro", rotulo: "Claro", icone: "sol", soIcone: true }, { valor: "escuro", rotulo: "Escuro", icone: "lua", soIcone: true }]} />
}
function Tamanho() {
  const [v, setV] = useState("m")
  return <Segmentado forma="compacto" rotulo="Tamanho sugerido" valor={v} aoMudar={setV} opcoes={[{ valor: "p", rotulo: "P" }, { valor: "m", rotulo: "M" }, { valor: "g", rotulo: "G" }]} />
}

export const Vitrine: Story = {
  args: { opcoes: [], valor: "", aoMudar: () => {}, rotulo: "" },
  render: () => (
    <Fileira gap={24}>
      <Produto />
      <Tema />
      <Tamanho />
    </Fileira>
  ),
}

export const Padrao: Story = { args: { opcoes: [], valor: "", aoMudar: () => {}, rotulo: "" }, render: () => <Produto /> }
export const PillDeTema: Story = { args: { opcoes: [], valor: "", aoMudar: () => {}, rotulo: "" }, render: () => <Tema /> }
export const Compacto: Story = { args: { opcoes: [], valor: "", aoMudar: () => {}, rotulo: "" }, render: () => <Tamanho /> }
