import type { Meta, StoryObj } from "@storybook/react"
import React, { useState } from "react"
import leia from "./README.md?raw"
import { NotaAutoadesiva } from "./NotaAutoadesiva"

const meta = {
  title: "Quadro/NotaAutoadesiva",
  component: NotaAutoadesiva,
  tags: ["autodocs"],
  args: { fonte: "likert", titulo: "A cotação muda entre simular e confirmar", volume: "412 menções", impacto: "alto", tendencia: { direcao: "sobe", valor: "22%" }, giro: -1.8 },
  parameters: { docs: { description: { component: leia } }, claudeDesign: { altura: 240, largura: 1060 } },
} satisfies Meta<typeof NotaAutoadesiva>

export default meta
type Story = StoryObj<typeof meta>

function Quadro() {
  const [marcada, setMarcada] = useState(true)
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 230px)", gap: 22, alignItems: "start", padding: 8 }}>
      <NotaAutoadesiva fonte="likert" titulo="A cotação muda entre simular e confirmar" volume="412 menções" impacto="alto" tendencia={{ direcao: "sobe", valor: "22%" }} giro={-1.8} />
      <NotaAutoadesiva fonte="voz" titulo="Minha transação de câmbio estornou e não recebi nenhuma notificação" volume="1.284 ligações" impacto="alto" tendencia={{ direcao: "sobe", valor: "31%" }} giro={1} />
      <NotaAutoadesiva fonte="fullstory" titulo="Rage click no botão Confirmar remessa" volume="2.140 clientes" impacto="medio" tendencia={{ direcao: "desce", valor: "8%" }} giro={-0.6} />
      <NotaAutoadesiva fonte="likert" titulo="Não sei quando o dinheiro chega lá fora" volume="338 menções" impacto="baixo" tendencia={{ direcao: "igual" }} giro={1.4} marcada={marcada} aoClicar={() => setMarcada((m) => !m)} />
    </div>
  )
}

export const Vitrine: Story = { render: () => <Quadro /> }
export const Escolhivel: Story = { args: { aoClicar: () => {}, marcada: true }, render: (args) => <div style={{ width: 240, padding: 12 }}><NotaAutoadesiva {...args} /></div> }
export const Grande: Story = { args: { fonte: "fullstory", titulo: "Rage click no botão Confirmar remessa", volume: "2.140 clientes", tamanho: "grande", tendencia: { direcao: "sobe", valor: "26%" }, giro: 0 }, render: (args) => <div style={{ width: 250 }}><NotaAutoadesiva {...args} /></div> }
