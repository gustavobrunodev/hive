import type { Meta, StoryObj } from "@storybook/react"
import React from "react"
import leia from "./README.md?raw"
import { Fileira } from "../../stories/ajudantes"
import { Toast } from "./Toast"

const meta = {
  title: "Avisos/Toast",
  component: Toast,
  tags: ["autodocs"],
  args: { children: "Elemento inserido · Ponto de restauração criado" },
  parameters: { docs: { description: { component: leia } }, claudeDesign: { altura: 150 } },
} satisfies Meta<typeof Toast>

export default meta
type Story = StoryObj<typeof meta>

export const Vitrine: Story = {
  render: () => (
    <Fileira coluna>
      <Toast>Elemento inserido · Ponto de restauração criado</Toast>
      <Toast icone="info">Variantes descartadas. Nada mudou.</Toast>
    </Fileira>
  ),
}
export const Confirmacao: Story = {}
export const Informacao: Story = { args: { icone: "info", children: "O Atual é a tela de hoje. Insira numa Proposta." } }
