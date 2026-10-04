import type { Meta, StoryObj } from "@storybook/react"
import React from "react"
import leia from "./README.md?raw"
import { Fileira } from "../../stories/ajudantes"
import { Pilula, PilulaDeImpacto, Tendencia } from "./Pilula"

const meta = {
  title: "Rótulos/Pilula",
  component: PilulaDeImpacto,
  tags: ["autodocs"],
  args: { nivel: "alto" },
  parameters: { docs: { description: { component: leia } }, claudeDesign: { altura: 110 } },
} satisfies Meta<typeof PilulaDeImpacto>

export default meta
type Story = StoryObj<typeof meta>

export const Vitrine: Story = {
  render: () => (
    <Fileira coluna>
      <Fileira>
        <PilulaDeImpacto nivel="alto" />
        <PilulaDeImpacto nivel="medio" />
        <PilulaDeImpacto nivel="baixo" />
        <Pilula tom="ok" icone="ok">Resolvido</Pilula>
      </Fileira>
      <Fileira>
        <Tendencia direcao="sobe" valor="22%" />
        <Tendencia direcao="desce" valor="8%" />
        <Tendencia direcao="igual" />
      </Fileira>
    </Fileira>
  ),
}

export const Alto: Story = {}
export const Medio: Story = { args: { nivel: "medio" } }
export const Baixo: Story = { args: { nivel: "baixo" } }
