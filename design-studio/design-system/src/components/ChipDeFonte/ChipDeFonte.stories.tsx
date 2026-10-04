import type { Meta, StoryObj } from "@storybook/react"
import React from "react"
import leia from "./README.md?raw"
import { Caixa, Fileira } from "../../stories/ajudantes"
import { ChipDeDor, ChipDeFonte } from "./ChipDeFonte"

const meta = {
  title: "Rótulos/ChipDeFonte",
  component: ChipDeFonte,
  tags: ["autodocs"],
  args: { fonte: "likert" },
  parameters: { docs: { description: { component: leia } }, claudeDesign: { altura: 190 } },
} satisfies Meta<typeof ChipDeFonte>

export default meta
type Story = StoryObj<typeof meta>

export const Vitrine: Story = {
  render: () => (
    <Fileira coluna>
      <Fileira>
        <ChipDeFonte fonte="likert" anunciar />
        <ChipDeFonte fonte="voz" anunciar />
        <ChipDeFonte fonte="fullstory" anunciar />
        <ChipDeFonte fonte="voz" tamanho="m" anunciar />
        <ChipDeFonte fonte="fullstory" tamanho="g" anunciar />
      </Fileira>
      <Caixa largura={420}>
        <Fileira>
          <ChipDeDor fonte="voz" titulo="Minha transação de câmbio estornou e não recebi nenhuma notificação" aoRemover={() => {}} />
          <ChipDeDor fonte="likert" titulo="Não sei quando o dinheiro chega lá fora" />
        </Fileira>
      </Caixa>
    </Fileira>
  ),
}

export const Likert: Story = {}
export const Dor: Story = { render: () => <ChipDeDor fonte="voz" titulo="Não sei quando o dinheiro chega lá fora" aoRemover={() => {}} /> }
