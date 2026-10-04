import type { Meta, StoryObj } from "@storybook/react"
import React from "react"
import leia from "./README.md?raw"
import { Botao } from "../Botao/Botao"
import { Painel } from "./Painel"

const meta = {
  title: "Superfícies/Painel",
  component: Painel,
  tags: ["autodocs"],
  args: { titulo: "Dores por categoria", subtitulo: "Ligações no período.", children: <p style={{ margin: 0 }}>Conteúdo do painel.</p> },
  parameters: { docs: { description: { component: leia } }, claudeDesign: { altura: 170, largura: 600 } },
} satisfies Meta<typeof Painel>

export default meta
type Story = StoryObj<typeof meta>

export const Vitrine: Story = {
  args: { idDoTitulo: "painel-vitrine", acao: <Botao variante="terciario" tamanho="pequeno" icone="tabela">Ver tabela</Botao> },
  render: (args) => <div style={{ maxWidth: 520 }}><Painel {...args} /></div>,
}
export const SemCabecalho: Story = { args: { titulo: undefined, subtitulo: undefined } }
