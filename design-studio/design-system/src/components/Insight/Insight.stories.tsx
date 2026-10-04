import type { Meta, StoryObj } from "@storybook/react"
import React from "react"
import leia from "./README.md?raw"
import { Botao } from "../Botao/Botao"
import { Insight, PainelDeInsights } from "./Insight"

const meta = {
  title: "Dados/Insight",
  component: Insight,
  tags: ["autodocs"],
  parameters: { docs: { description: { component: leia } }, claudeDesign: { altura: 640, largura: 900 } },
} satisfies Meta<typeof Insight>

export default meta
type Story = StoryObj<typeof meta>

const acoes = (n: number) => (
  <>
    <Botao variante="secundario" tamanho="pequeno" icone="camadas">{n > 1 ? "Resolver estas Dores" : "Resolver esta Dor"}</Botao>
    <Botao variante="terciario" tamanho="pequeno" icone="comentar">Perguntar ao agente</Botao>
  </>
)

const vazio = { titulo: "", numeros: [], agente: "claude" as const, children: null }

export const Vitrine: Story = {
  args: vazio,
  render: () => (
    <PainelDeInsights subtitulo="O que o Claude lê em cada categoria, com o próximo passo sugerido.">
      <Insight
        foco
        titulo="Cotação e taxas"
        agente="claude"
        numeros={[{ rotulo: "do volume", valor: "15%" }, { rotulo: "no período", valor: "+6%" }, { rotulo: "ligam de novo", valor: "11%" }]}
        proximoPasso="Travar a cotação por alguns minutos e mostrar o total debitado desde a simulação."
        dores={[{ fonte: "voz", titulo: "A cotação cobrada foi diferente da simulada" }]}
        acoes={acoes(1)}
      >
        <p>A taxa muda entre simular e confirmar, e o custo total só aparece no fim.</p>
      </Insight>
      <Insight
        titulo="Status e avisos"
        agente="claude"
        numeros={[{ rotulo: "do volume", valor: "69%" }, { rotulo: "no período", valor: "+15%" }, { rotulo: "ligam de novo", valor: "34%" }]}
        proximoPasso="Mostrar cada etapa do envio e avisar na hora em que algo dá errado."
        dores={[{ fonte: "voz", titulo: "Minha transação de câmbio estornou e não recebi nenhuma notificação" }, { fonte: "voz", titulo: "Não entendo o motivo da remessa recusada" }]}
        acoes={acoes(2)}
      >
        <p>O cliente descobre o que aconteceu com a remessa fora do app: no extrato, pelo beneficiário ou ligando.</p>
      </Insight>
    </PainelDeInsights>
  ),
}
