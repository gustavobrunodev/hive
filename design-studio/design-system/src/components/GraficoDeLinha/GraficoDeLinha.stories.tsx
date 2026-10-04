import type { Meta, StoryObj } from "@storybook/react"
import React from "react"
import leia from "./README.md?raw"
import { serieDaCategoria } from "../../stories/dados"
import { GraficoDeLinha } from "./GraficoDeLinha"

const meta = {
  title: "Dados/GraficoDeLinha",
  component: GraficoDeLinha,
  tags: ["autodocs"],
  args: { serie: serieDaCategoria("cotacao"), nomeDaSerie: "Cotação e taxas", subtitulo: "Quantas vezes as Dores de Cotação e taxas aparecem por semana." },
  parameters: { docs: { description: { component: leia } }, claudeDesign: { altura: 380, largura: 900 } },
  decorators: [(Historia) => <div style={{ maxWidth: 600 }}><Historia /></div>],
} satisfies Meta<typeof GraficoDeLinha>

export default meta
type Story = StoryObj<typeof meta>

export const Vitrine: Story = {}
export const TrintaDias: Story = { args: { serie: serieDaCategoria("status", 4), nomeDaSerie: "Status e avisos", subtitulo: undefined } }
