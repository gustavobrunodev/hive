import type { Meta, StoryObj } from "@storybook/react"
import React from "react"
import leia from "./README.md?raw"
import { MolduraDeAparelho } from "./MolduraDeAparelho"

const meta = {
  title: "Quadro/MolduraDeAparelho",
  component: MolduraDeAparelho,
  tags: ["autodocs"],
  args: { nome: "Revisar", emFoco: true, estado: "criando" },
  parameters: { docs: { description: { component: leia } }, claudeDesign: { altura: 870, largura: 900 } },
} satisfies Meta<typeof MolduraDeAparelho>

export default meta
type Story = StoryObj<typeof meta>

export const Vitrine: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 48, alignItems: "flex-start", padding: 8 }}>
      <MolduraDeAparelho nome="Revisar" emFoco estado="criando" />
      <MolduraDeAparelho nome="Confirmar" estado="na-fila" />
    </div>
  ),
}

export const Criando: Story = {}
export const ComConteudo: Story = {
  args: { estado: "pronto", children: <div style={{ padding: "64px 22px", color: "#1a1a1a" }}>Conteúdo do Protótipo</div> },
}
export const Desktop: Story = { args: { dispositivo: "desktop", estado: "criando", nome: "Extrato" } }
