import type { Meta, StoryObj } from "@storybook/react"
import React from "react"
import leia from "./README.md?raw"
import { Fileira } from "../../stories/ajudantes"
import { LogoDoAgente } from "./LogoDoAgente"

const meta = {
  title: "Agentes/LogoDoAgente",
  component: LogoDoAgente,
  tags: ["autodocs"],
  args: { agente: "claude" },
  parameters: { docs: { description: { component: leia } }, claudeDesign: { altura: 90 } },
} satisfies Meta<typeof LogoDoAgente>

export default meta
type Story = StoryObj<typeof meta>

export const Vitrine: Story = {
  render: () => (
    <Fileira>
      <LogoDoAgente agente="claude" tamanho="pequeno" anunciar />
      <LogoDoAgente agente="devin" tamanho="pequeno" anunciar />
      <LogoDoAgente agente="claude" anunciar />
      <LogoDoAgente agente="devin" anunciar />
      <LogoDoAgente agente="claude" tamanho="grande" anunciar />
      <LogoDoAgente agente="devin" tamanho="grande" anunciar />
    </Fileira>
  ),
}

export const Claude: Story = {}
export const Devin: Story = { args: { agente: "devin" } }
export const Grande: Story = { args: { tamanho: "grande", anunciar: true } }
