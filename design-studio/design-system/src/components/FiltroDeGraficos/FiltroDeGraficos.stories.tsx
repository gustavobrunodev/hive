import type { Meta, StoryObj } from "@storybook/react"
import React, { useState } from "react"
import leia from "./README.md?raw"
import { GRUPOS, PERIODOS } from "../../stories/dados"
import { FiltroDeGraficos } from "./FiltroDeGraficos"

const meta = {
  title: "Dados/FiltroDeGraficos",
  component: FiltroDeGraficos,
  tags: ["autodocs"],
  parameters: { docs: { description: { component: leia } }, claudeDesign: { altura: 90, largura: 1000 } },
} satisfies Meta<typeof FiltroDeGraficos>

export default meta
type Story = StoryObj<typeof meta>

function Filtro({ inicial = "todas" }: { inicial?: string }) {
  const [periodo, setPeriodo] = useState("13")
  const [dor, setDor] = useState(inicial)
  return <FiltroDeGraficos periodos={PERIODOS} periodo={periodo} aoMudarPeriodo={setPeriodo} grupos={GRUPOS} dor={dor} aoMudarDor={setDor} aoLimpar={() => setDor("todas")} />
}

const vazio = { periodos: [], periodo: "", aoMudarPeriodo: () => {}, grupos: [], dor: "todas", aoMudarDor: () => {} }

export const Vitrine: Story = { args: vazio, render: () => <Filtro inicial="cam-v2" /> }
export const SemRecorte: Story = { args: vazio, render: () => <Filtro /> }
