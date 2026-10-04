import type { Meta, StoryObj } from "@storybook/react"
import React, { useState } from "react"
import leia from "./README.md?raw"
import { AbasDeProposta } from "../AbasDeProposta/AbasDeProposta"
import { BarraFlutuante, Ferramenta, SeparadorDeFerramenta } from "./BarraDeFerramentas"

const meta = {
  title: "Navegação/BarraDeFerramentas",
  component: BarraFlutuante,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen", docs: { description: { component: leia } }, claudeDesign: { altura: 210, largura: 1180 } },
} satisfies Meta<typeof BarraFlutuante>

export default meta
type Story = StoryObj<typeof meta>

const FERRAMENTAS = [
  ["mover", "selecionar", "Mover"],
  ["comentar", "comentar", "Comentar"],
  ["editar", "editar", "Editar"],
  ["inserir", "inserir", "Inserir"],
  ["ajustar", "ajustar", "Ajustar"],
] as const

function Canvas() {
  const [ativa, setAtiva] = useState<string>("inserir")
  const [sel, setSel] = useState("a")
  return (
    <div
      style={{
        position: "relative",
        height: 210,
        backgroundColor: "var(--quadro)",
        backgroundImage: "radial-gradient(var(--ponto) 1.15px, var(--quadro) 1.4px)",
        backgroundSize: "22px 22px",
      }}
    >
      <div style={{ position: "absolute", top: 14, left: 14, right: 14, display: "flex", alignItems: "center", gap: 10 }}>
        <AbasDeProposta
          selecionada={sel}
          aoSelecionar={setSel}
          aoCriar={() => {}}
          propostas={[
            { id: "atual", nome: "Atual" },
            { id: "a", nome: "A · Status que avisa", estado: "ativa" },
            { id: "b", nome: "B · Rastreio do envio" },
          ]}
        />
        <span style={{ flex: 1 }} />
        <BarraFlutuante rotulo="Visualização">
          <Ferramenta icone="celular" rotulo="Ver no celular" soIcone pressionada />
          <Ferramenta icone="monitor" rotulo="Ver no desktop" soIcone pressionada={false} />
          <SeparadorDeFerramenta />
          <Ferramenta icone="apresentar" rotulo="Apresentar" />
          <Ferramenta icone="compartilhar" rotulo="Compartilhar" />
        </BarraFlutuante>
      </div>
      <div style={{ position: "absolute", left: "50%", bottom: 18, transform: "translateX(-50%)" }}>
        <BarraFlutuante rotulo="Ferramentas">
          {FERRAMENTAS.map(([id, icone, rotulo]) => (
            <Ferramenta key={id} icone={icone} rotulo={rotulo} pressionada={ativa === id} onClick={() => setAtiva(id)} />
          ))}
          <SeparadorDeFerramenta />
          <Ferramenta icone="testar" rotulo="Testar" destaque />
          <SeparadorDeFerramenta />
          <Ferramenta icone="zoomMenos" rotulo="Diminuir zoom" soIcone />
          <Ferramenta icone="zoomMais" rotulo="Aumentar zoom" soIcone />
        </BarraFlutuante>
      </div>
    </div>
  )
}

export const Vitrine: Story = { args: { rotulo: "Ferramentas", children: null }, render: () => <Canvas /> }
