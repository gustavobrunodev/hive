import type { Meta, StoryObj } from "@storybook/react"
import React, { useState } from "react"
import leia from "./README.md?raw"
import { BarraDeProgresso } from "../BarraDeProgresso/BarraDeProgresso"
import { Botao } from "../Botao/Botao"
import { Segmentado } from "../Segmentado/Segmentado"
import { LinhaDoPainel, NavegacaoDeVariantes, PainelFlutuante, Sugestoes } from "./PainelFlutuante"

const meta = {
  title: "Modo ao vivo/PainelFlutuante",
  component: PainelFlutuante,
  tags: ["autodocs"],
  parameters: { docs: { description: { component: leia } }, claudeDesign: { altura: 540, largura: 1020 } },
} satisfies Meta<typeof PainelFlutuante>

export default meta
type Story = StoryObj<typeof meta>

const SUGESTOES = [
  { valor: "aviso", rotulo: "Aviso" },
  { valor: "ajuda", rotulo: "Texto de ajuda" },
  { valor: "botao", rotulo: "Botão" },
  { valor: "campo", rotulo: "Campo" },
  { valor: "etapas", rotulo: "Etapas" },
  { valor: "resumo", rotulo: "Resumo" },
] as const

function Config() {
  const [onde, setOnde] = useState("depois")
  const [tipo, setTipo] = useState<string | null>("aviso")
  const [tam, setTam] = useState("m")
  const [qtd, setQtd] = useState("3")
  const [pedido, setPedido] = useState("Um aviso explicando por que o IBAN precisa estar completo")
  return (
    <PainelFlutuante
      rotulo="Inserir na tela Revisar"
      icone="inserir"
      titulo="Depois do bloco “Beneficiário”"
      subtitulo="Revisar · Proposta A"
      aoFechar={() => {}}
      rodape={<Botao icone="raio" disabled={!pedido.trim()}>Gerar Variantes</Botao>}
    >
      <LinhaDoPainel rotulo="Onde">
        <Segmentado forma="compacto" rotulo="Posição" valor={onde} aoMudar={setOnde} opcoes={[{ valor: "antes", rotulo: "Antes" }, { valor: "depois", rotulo: "Depois" }]} />
      </LinhaDoPainel>
      <label className="dst-sr" htmlFor="pedido-historia">O que inserir</label>
      <textarea id="pedido-historia" rows={2} value={pedido} onChange={(e) => setPedido(e.target.value)} placeholder="O que entra aqui? Ex.: um aviso explicando o estorno" />
      <Sugestoes rotulo="Sugestões" opcoes={SUGESTOES} valor={tipo} aoMudar={setTipo} />
      <LinhaDoPainel rotulo="Tamanho">
        <Segmentado forma="compacto" rotulo="Tamanho sugerido" valor={tam} aoMudar={setTam} opcoes={[{ valor: "p", rotulo: "P" }, { valor: "m", rotulo: "M" }, { valor: "g", rotulo: "G" }]} />
      </LinhaDoPainel>
      <LinhaDoPainel rotulo="Quantas Variantes">
        <Segmentado forma="compacto" rotulo="Quantidade" valor={qtd} aoMudar={setQtd} opcoes={["1", "2", "3", "4"].map((n) => ({ valor: n, rotulo: n }))} />
      </LinhaDoPainel>
    </PainelFlutuante>
  )
}

function Gerando() {
  return (
    <PainelFlutuante rotulo="Gerando Variantes" icone="inserir" titulo="Depois do bloco “Beneficiário”" subtitulo="Revisar · Proposta A" rodape={<Botao variante="secundario" tamanho="pequeno">Cancelar</Botao>}>
      <span style={{ fontSize: "0.875rem", color: "var(--tinta-2)" }}>Gerando 3 Variantes de Aviso…</span>
      <BarraDeProgresso valor={1 / 3} rotulo="Progresso das Variantes" />
    </PainelFlutuante>
  )
}

function Ciclo() {
  const [i, setI] = useState(1)
  const nomes = ["Aviso · Informativo", "Aviso · Com ação", "Aviso · Alerta"]
  return (
    <PainelFlutuante
      rotulo="Variantes de Aviso"
      icone="inserir"
      titulo="Depois do bloco “Beneficiário”"
      subtitulo="Revisar · Proposta A"
      aoFechar={() => {}}
      rodape={
        <>
          <Botao variante="secundario" tamanho="pequeno">Descartar</Botao>
          <Botao tamanho="pequeno" icone="ok">Inserir</Botao>
        </>
      }
    >
      <NavegacaoDeVariantes atual={i + 1} total={3} nome={nomes[i]!} aoAnterior={() => setI((v) => (v + 2) % 3)} aoProxima={() => setI((v) => (v + 1) % 3)} />
      <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--tinta-2)" }}>Fundo neutro e ícone de informação: explica sem alarmar.</p>
    </PainelFlutuante>
  )
}

const vazio = { rotulo: "", titulo: "", children: null }

export const Vitrine: Story = {
  args: vazio,
  render: () => (
    <div style={{ display: "flex", gap: 28, alignItems: "flex-start", flexWrap: "wrap" }}>
      <Config />
      <Gerando />
      <Ciclo />
    </div>
  ),
}
export const Configuracao: Story = { args: vazio, render: () => <Config /> }
export const Ciclo_: Story = { name: "Ciclo de Variantes", args: vazio, render: () => <Ciclo /> }
