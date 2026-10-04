import type { Meta, StoryObj } from "@storybook/react"
import React from "react"
import leia from "./README.md?raw"
import { MensagemDaPessoa } from "./MensagemDaPessoa"

const meta = {
  title: "Conversa/MensagemDaPessoa",
  component: MensagemDaPessoa,
  tags: ["autodocs"],
  args: { hora: "14:12", children: <p>Resolve primeiro o estorno sem aviso. O cliente precisa saber que o dinheiro voltou e o que fazer.</p> },
  parameters: { docs: { description: { component: leia } }, claudeDesign: { altura: 330, largura: 460 } },
  decorators: [(Historia) => <div style={{ maxWidth: 380 }}><Historia /></div>],
} satisfies Meta<typeof MensagemDaPessoa>

export default meta
type Story = StoryObj<typeof meta>

export const Vitrine: Story = {
  render: () => (
    <div style={{ display: "grid", gap: 18 }}>
      <MensagemDaPessoa hora="14:12" citacoes={[{ fonte: "voz", titulo: "Minha transação de câmbio estornou e não recebi nenhuma notificação" }]}>
        <p>Resolve primeiro o estorno sem aviso. O cliente precisa saber que o dinheiro voltou e o que fazer.</p>
      </MensagemDaPessoa>
      <MensagemDaPessoa hora="11:14" origem="Ponto de inserção no canvas" selecao={{ elemento: "Inserir depois do bloco “Beneficiário”", pedido: "Aviso: Um aviso explicando por que o IBAN precisa estar completo" }} />
    </div>
  ),
}
export const Texto: Story = {}
export const Selecao: Story = { args: { origem: "Selecionado no canvas", selecao: { elemento: "Botão “Confirmar remessa”", pedido: "Deixar mais claro: Por que ele está desabilitado?", icone: "editar" } } }
