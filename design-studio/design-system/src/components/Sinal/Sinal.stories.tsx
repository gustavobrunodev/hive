import type { Meta, StoryObj } from "@storybook/react"
import React from "react"
import leia from "./README.md?raw"
import { Fileira } from "../../stories/ajudantes"
import { Marca, Sinal } from "./Sinal"

const meta = {
  title: "Marca e ícones/Sinal",
  component: Sinal,
  tags: ["autodocs"],
  parameters: { docs: { description: { component: leia } }, claudeDesign: { altura: 90 } },
} satisfies Meta<typeof Sinal>

export default meta
type Story = StoryObj<typeof meta>

export const Vitrine: Story = {
  render: () => (
    <Fileira gap={28}>
      <Sinal tamanho={48} rotulo="Design Studio" />
      <Marca href="#" />
      <Marca soSinal />
    </Fileira>
  ),
}

export const Padrao: Story = {}
