import type { Meta, StoryObj } from "@storybook/react"
import React from "react"
import leia from "./README.md?raw"
import { Fileira } from "../../stories/ajudantes"
import { Seletor } from "./Seletor"

const meta = {
  title: "Seleção/Seletor",
  component: Seletor,
  tags: ["autodocs"],
  args: { valor: "Novo Protótipo", complemento: "· Câmbio", icone: "camadas" },
  parameters: { docs: { description: { component: leia } }, claudeDesign: { altura: 80 } },
} satisfies Meta<typeof Seletor>

export default meta
type Story = StoryObj<typeof meta>

export const Vitrine: Story = {
  render: () => (
    <Fileira>
      <Seletor valor="Novo Protótipo" complemento="· Câmbio" icone="camadas" title="Em qual Protótipo você vai trabalhar" />
      <Seletor valor="Claude" complemento="Sonnet" agente="claude" title="Agente e modelo" />
      <Seletor valor="Devin" complemento="SWE-1.5" agente="devin" aberto title="Agente e modelo" />
    </Fileira>
  ),
}

export const Prototipo: Story = {}
export const Agente: Story = { args: { valor: "Claude", complemento: "Sonnet", agente: "claude", icone: undefined } }
