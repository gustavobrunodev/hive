import type { Meta, StoryObj } from "@storybook/react"
import React, { useState } from "react"
import leia from "./README.md?raw"
import { CATEGORIAS } from "../../stories/dados"
import { GraficoDeBarras } from "./GraficoDeBarras"

const meta = {
  title: "Dados/GraficoDeBarras",
  component: GraficoDeBarras,
  tags: ["autodocs"],
  args: { categorias: CATEGORIAS, emFoco: "cotacao" },
  parameters: { docs: { description: { component: leia } }, claudeDesign: { altura: 340, largura: 900 } },
  decorators: [(Historia) => <div style={{ maxWidth: 560 }}><Historia /></div>],
} satisfies Meta<typeof GraficoDeBarras>

export default meta
type Story = StoryObj<typeof meta>

function Interativo() {
  const [foco, setFoco] = useState("cotacao")
  return <GraficoDeBarras categorias={CATEGORIAS} emFoco={foco} aoFocar={setFoco} />
}

export const Vitrine: Story = { render: () => <Interativo /> }
export const ComRecorte: Story = { args: { emFoco: "status", recorte: { volume: 1284, rotulo: "Minha transação de câmbio estornou e não recebi nenhuma notificação" } } }
