import type { Meta, StoryObj } from "@storybook/react"
import React from "react"
import leia from "./README.md?raw"
import { MiraDeInsercao, PreviaDeInsercao, VagaDeInsercao } from "./Inserir"

const meta = {
  title: "Modo ao vivo/Inserir",
  component: VagaDeInsercao,
  tags: ["autodocs"],
  parameters: { docs: { description: { component: leia } }, claudeDesign: { altura: 480, largura: 440 } },
} satisfies Meta<typeof VagaDeInsercao>

export default meta
type Story = StoryObj<typeof meta>

const bloco = (altura: number) => <div style={{ height: altura, borderRadius: 12, background: "#ececea" }} />

export const Vitrine: Story = {
  render: () => (
    <div style={{ position: "relative", width: 360, background: "#ffffff", borderRadius: 26, padding: "26px 20px", display: "grid", gap: 16, boxShadow: "var(--sombra-1)", ["--acento-tinta" as string]: "#a34c00" }}>
      {bloco(64)}
      {bloco(40)}
      <MiraDeInsercao rotulo="Inserir depois do bloco “Beneficiário”" topo={154} esquerda={20} largura={320} />
      <VagaDeInsercao tamanho="m" gerando>
        Gerando Variante 2 de 3…
      </VagaDeInsercao>
      <PreviaDeInsercao>{bloco(64)}</PreviaDeInsercao>
      {bloco(40)}
    </div>
  ),
}

export const Vaga: Story = { args: { tamanho: "p", children: "Aviso · tamanho P" } }
export const Gerando: Story = { args: { tamanho: "g", gerando: true, children: "Gerando Variante 1 de 3…" } }
