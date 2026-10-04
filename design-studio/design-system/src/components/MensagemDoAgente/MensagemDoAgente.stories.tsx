import type { Meta, StoryObj } from "@storybook/react"
import React from "react"
import leia from "./README.md?raw"
import { MensagemDoAgente } from "./MensagemDoAgente"

const meta = {
  title: "Conversa/MensagemDoAgente",
  component: MensagemDoAgente,
  tags: ["autodocs"],
  args: {
    agente: "claude",
    modelo: "Sonnet",
    hora: "11:14",
    children: <p>Inseri um aviso (informativo) depois do bloco “Beneficiário”, na tela Revisar da Proposta A.</p>,
  },
  parameters: { docs: { description: { component: leia } }, claudeDesign: { altura: 330, largura: 460 } },
  decorators: [(Historia) => <div style={{ maxWidth: 380 }}><Historia /></div>],
} satisfies Meta<typeof MensagemDoAgente>

export default meta
type Story = StoryObj<typeof meta>

export const Vitrine: Story = {
  args: {
    carimbo: "Aviso inserido · Variante 2",
    acoes: ["Criou um elemento novo na tela Revisar", "Conferiu o Protótipo: abre sem erros"],
    pontoDeRestauracao: "Aviso inserido",
    aoAbrirPonto: () => {},
    children: (
      <>
        <p>Inseri um aviso (informativo) depois do bloco “Beneficiário”, na tela Revisar da Proposta A.</p>
        <p>Usei os componentes e os tokens do design system do Protótipo.</p>
      </>
    ),
  },
}
export const Simples: Story = {}
export const Devin: Story = { args: { agente: "devin", modelo: "SWE-1.5" } }
