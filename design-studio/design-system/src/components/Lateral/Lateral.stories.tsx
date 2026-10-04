import type { Meta, StoryObj } from "@storybook/react"
import React, { useState } from "react"
import leia from "./README.md?raw"
import { Lateral, type LateralProps, type Tema } from "./Lateral"

const meta = {
  title: "Navegação/Lateral",
  component: Lateral,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen", docs: { description: { component: leia } }, claudeDesign: { altura: 680, largura: 840 } },
} satisfies Meta<typeof Lateral>

export default meta
type Story = StoryObj<typeof meta>

const dados: Omit<LateralProps, "tema" | "aoMudarTema"> = {
  itens: [
    { id: "inicio", rotulo: "Início", icone: "inicio", href: "#" },
    { id: "prototipos", rotulo: "Protótipos", icone: "camadas", href: "#" },
    { id: "dores", rotulo: "Dores", icone: "dor", href: "#" },
    { id: "relatorios", rotulo: "Relatórios", icone: "relatorio", href: "#" },
  ],
  atual: "inicio",
  novo: { rotulo: "Nova conversa", href: "#" },
  recentes: [
    { id: "remessa", titulo: "Remessa sem susto", subtitulo: "Câmbio · há 12 min", icone: "camadas", href: "#" },
    { id: "extrato", titulo: "Extrato sem limite de 90 dias", subtitulo: "Extrato · ontem, 18:04", icone: "camadas", href: "#" },
    { id: "dores-cambio", titulo: "Dores que se repetem em Câmbio", subtitulo: "Câmbio · ontem", icone: "conversa", href: "#" },
  ],
  rodape: [{ id: "config", rotulo: "Configurações", icone: "config", href: "#" }],
  conta: { nome: "Marina Alves", papel: "Product Manager · exemplo", iniciais: "MA" },
}

function ComTema({ recolhida = false }: { recolhida?: boolean }) {
  const [tema, setTema] = useState<Tema>("claro")
  const [fechada, setFechada] = useState(recolhida)
  return (
    <div style={{ height: 680, display: "flex" }}>
      <Lateral {...dados} tema={tema} aoMudarTema={setTema} recolhida={fechada} aoRecolher={() => setFechada((f) => !f)} />
    </div>
  )
}

export const Vitrine: Story = { args: dados, render: () => <ComTema /> }
export const Recolhida: Story = { args: dados, render: () => <ComTema recolhida /> }
