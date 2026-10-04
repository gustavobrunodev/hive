import type { Meta, StoryObj } from "@storybook/react"
import React, { useState } from "react"
import leia from "./README.md?raw"
import { AbasDeProposta, type Proposta } from "./AbasDeProposta"

const meta = {
  title: "Navegação/AbasDeProposta",
  component: AbasDeProposta,
  tags: ["autodocs"],
  parameters: { docs: { description: { component: leia } }, claudeDesign: { altura: 90, largura: 840 } },
} satisfies Meta<typeof AbasDeProposta>

export default meta
type Story = StoryObj<typeof meta>

const propostas: Proposta[] = [
  { id: "atual", nome: "Atual", descricao: "Recriado a partir de 3 prints e 1 sessão do FullStory." },
  { id: "a", nome: "A · Status que avisa", estado: "ativa" },
  { id: "b", nome: "B · Rastreio do envio", estado: "rascunho" },
  { id: "c", nome: "C · Aviso no topo", estado: "descartada" },
]

function Abas() {
  const [sel, setSel] = useState("a")
  return <AbasDeProposta propostas={propostas} selecionada={sel} aoSelecionar={setSel} aoCriar={() => {}} />
}

export const Vitrine: Story = { args: { propostas, selecionada: "a", aoSelecionar: () => {} }, render: () => <Abas /> }
