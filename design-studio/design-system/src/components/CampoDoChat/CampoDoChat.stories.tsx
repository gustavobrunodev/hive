import type { Meta, StoryObj } from "@storybook/react"
import React, { useState } from "react"
import leia from "./README.md?raw"
import { Seletor } from "../Seletor/Seletor"
import { CampoDoChat, type Citacao } from "./CampoDoChat"

const meta = {
  title: "Entrada/CampoDoChat",
  component: CampoDoChat,
  tags: ["autodocs"],
  parameters: { docs: { description: { component: leia } }, claudeDesign: { altura: 230, largura: 840 } },
} satisfies Meta<typeof CampoDoChat>

export default meta
type Story = StoryObj<typeof meta>

const DOR: Citacao = { id: "cam-v2", fonte: "voz", titulo: "Não sei quando o dinheiro chega lá fora" }

function Campo({ tamanho = "inicio", comDor = true, gravando = false }: { tamanho?: "inicio" | "compacto"; comDor?: boolean; gravando?: boolean }) {
  const [texto, setTexto] = useState("")
  const [citacoes, setCitacoes] = useState<Citacao[]>(comDor ? [DOR] : [])
  return (
    <div style={{ maxWidth: 720 }}>
      <CampoDoChat
        tamanho={tamanho}
        valor={texto}
        aoMudar={setTexto}
        aoEnviar={() => setTexto("")}
        citacoes={citacoes}
        aoRemoverCitacao={(id) => setCitacoes((cs) => cs.filter((c) => c.id !== id))}
        placeholder={tamanho === "inicio" ? "Descreva o que você quer criar ou melhorar. Cole prints, cite Dores com @…" : undefined}
        aoAnexar={() => {}}
        aoGravar={() => {}}
        gravando={gravando}
        seletores={<Seletor valor="Novo Protótipo" complemento="· Câmbio" icone="camadas" />}
        agente={<Seletor valor="Claude" complemento="Sonnet" agente="claude" />}
      />
    </div>
  )
}

const vazio = { valor: "", aoMudar: () => {}, aoEnviar: () => {} }

export const Vitrine: Story = { args: vazio, render: () => <Campo /> }
export const Compacto: Story = { args: vazio, render: () => <Campo tamanho="compacto" comDor={false} /> }
export const Gravando: Story = { args: vazio, render: () => <Campo tamanho="compacto" comDor={false} gravando /> }
