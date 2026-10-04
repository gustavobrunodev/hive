import type { Meta, StoryObj } from "@storybook/react"
import React from "react"
import leia from "./README.md?raw"
import { CartaoDeRevisao } from "./CartaoDeRevisao"

const meta = {
  title: "Conversa/CartaoDeRevisao",
  component: CartaoDeRevisao,
  tags: ["autodocs"],
  args: {
    titulo: "Revisão de usabilidade da Proposta A",
    achados: [
      { nivel: "resolvido", texto: "Visibilidade do status: o estorno agora aparece com motivo e próximo passo." },
      { nivel: "alto", texto: "Prevenção de erros: o IBAN só é validado depois do envio. É a causa mais comum de estorno nas ligações." },
      { nivel: "medio", texto: "Linguagem: “Em processamento” continua vago nas etapas anteriores ao estorno." },
    ],
  },
  parameters: { docs: { description: { component: leia } }, claudeDesign: { altura: 330, largura: 460 } },
  decorators: [(Historia) => <div style={{ maxWidth: 380 }}><Historia /></div>],
} satisfies Meta<typeof CartaoDeRevisao>

export default meta
type Story = StoryObj<typeof meta>

export const Vitrine: Story = {}
