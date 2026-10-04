import type { Meta, StoryObj } from "@storybook/react"
import React from "react"
import leia from "./README.md?raw"
import { BarraDeProgresso } from "./BarraDeProgresso"

const meta = {
  title: "Avisos/BarraDeProgresso",
  component: BarraDeProgresso,
  tags: ["autodocs"],
  args: { valor: 0.33, rotulo: "Progresso das Variantes" },
  parameters: { docs: { description: { component: leia } }, claudeDesign: { altura: 110 } },
} satisfies Meta<typeof BarraDeProgresso>

export default meta
type Story = StoryObj<typeof meta>

export const Vitrine: Story = {
  render: () => (
    <div style={{ display: "grid", gap: 14, maxWidth: 300 }}>
      <BarraDeProgresso valor={0.33} rotulo="Um terço" />
      <BarraDeProgresso valor={0.66} rotulo="Dois terços" />
      <BarraDeProgresso valor={1} rotulo="Pronto" />
    </div>
  ),
}
export const UmTerco: Story = {}
