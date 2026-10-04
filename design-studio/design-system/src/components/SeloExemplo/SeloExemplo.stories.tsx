import type { Meta, StoryObj } from "@storybook/react"
import React from "react"
import leia from "./README.md?raw"
import { Fileira, Rotulo } from "../../stories/ajudantes"
import { SeloExemplo } from "./SeloExemplo"

const meta = {
  title: "Rótulos/SeloExemplo",
  component: SeloExemplo,
  tags: ["autodocs"],
  parameters: { docs: { description: { component: leia } }, claudeDesign: { altura: 100 } },
} satisfies Meta<typeof SeloExemplo>

export default meta
type Story = StoryObj<typeof meta>

export const Vitrine: Story = {
  render: () => (
    <Fileira gap={32}>
      <Fileira coluna gap={6}>
        <Rotulo>Na lateral aberta</Rotulo>
        <SeloExemplo forma="linha" />
      </Fileira>
      <Fileira coluna gap={6}>
        <Rotulo>No cabeçalho</Rotulo>
        <SeloExemplo />
      </Fileira>
    </Fileira>
  ),
}

export const Pill: Story = {}
export const Linha: Story = { args: { forma: "linha" } }
