import type { Meta, StoryObj } from "@storybook/react"
import React from "react"
import leia from "./README.md?raw"
import { nomesDosIcones } from "../../icones/icones"
import { Icone } from "./Icone"

const meta = {
  title: "Marca e ícones/Icone",
  component: Icone,
  tags: ["autodocs"],
  args: { nome: "raio" },
  parameters: { docs: { description: { component: leia } }, claudeDesign: { altura: 570, largura: 760 } },
} satisfies Meta<typeof Icone>

export default meta
type Story = StoryObj<typeof meta>

export const Vitrine: Story = {
  render: () => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))", gap: 10, color: "var(--tinta-2)" }}>
      {nomesDosIcones.map((nome) => (
        <div key={nome} style={{ display: "grid", justifyItems: "center", gap: 6, fontSize: "0.6875rem", color: "var(--tinta-3)" }}>
          <Icone nome={nome} tamanho={20} />
          <span>{nome}</span>
        </div>
      ))}
    </div>
  ),
}

export const Padrao: Story = {}

export const ComRotulo: Story = { args: { nome: "alerta", rotulo: "Atenção", tamanho: 24 } }
