import type { Meta, StoryObj } from "@storybook/react"
import React from "react"
import leia from "./README.md?raw"
import { Fileira } from "../../stories/ajudantes"
import { Botao, BotaoEnviar, BotaoIcone } from "./Botao"

const meta = {
  title: "Ações/Botao",
  component: Botao,
  tags: ["autodocs"],
  args: { children: "Gerar Variantes", variante: "primario" },
  parameters: { docs: { description: { component: leia } }, claudeDesign: { altura: 150 } },
} satisfies Meta<typeof Botao>

export default meta
type Story = StoryObj<typeof meta>

export const Vitrine: Story = {
  render: () => (
    <Fileira coluna>
      <Fileira>
        <Botao icone="raio">Gerar Variantes</Botao>
        <Botao variante="secundario">Descartar</Botao>
        <Botao variante="terciario">Limpar filtro</Botao>
        <Botao disabled>Gerar Variantes</Botao>
      </Fileira>
      <Fileira>
        <Botao tamanho="pequeno" icone="ok">Inserir</Botao>
        <Botao tamanho="pequeno" variante="secundario">Desfazer</Botao>
        <BotaoIcone rotulo="Fechar" icone="fechar" />
        <BotaoEnviar />
        <BotaoEnviar disabled />
      </Fileira>
    </Fileira>
  ),
}

export const Primario: Story = { args: { icone: "raio" } }
export const Secundario: Story = { args: { variante: "secundario", children: "Descartar" } }
export const Terciario: Story = { args: { variante: "terciario", children: "Limpar filtro" } }
export const Pequeno: Story = { args: { tamanho: "pequeno", icone: "ok", children: "Inserir" } }
export const Desabilitado: Story = { args: { disabled: true } }
export const ComoLink: Story = { args: { href: "#", variante: "secundario", children: "Abrir o Relatório" } }
