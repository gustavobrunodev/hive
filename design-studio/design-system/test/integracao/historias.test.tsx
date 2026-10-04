import React from "react"
import axe from "axe-core"
import { cleanup, render } from "@testing-library/react"
import { composeStories, setProjectAnnotations } from "@storybook/react"
import * as preview from "../../.storybook/preview"

/* Toda história do Storybook vira teste: renderiza com o mesmo preview (tema
   claro) e passa no axe. Contraste fica de fora porque o jsdom não calcula
   cor; ele é coberto pelo contrato de contraste em src/tokens/tokens.test.ts. */

setProjectAnnotations([preview])

type ModuloDeHistorias = Parameters<typeof composeStories>[0]
const modulos = import.meta.glob<ModuloDeHistorias>("../../src/**/*.stories.tsx", { eager: true })

const casos = Object.entries(modulos).flatMap(([arquivo, modulo]) =>
  Object.entries(composeStories(modulo)).map(([nome, Historia]) => [`${arquivo.replace("../../src/components/", "")} › ${nome}`, Historia as unknown as React.FC] as const)
)

describe("histórias do Storybook", () => {
  it("existe ao menos uma história por componente", () => {
    expect(casos.length).toBeGreaterThan(40)
  })

  it.each(casos)("%s renderiza e passa no axe", async (_nome, Historia) => {
    const erros: unknown[] = []
    const original = console.error
    console.error = (...args: unknown[]) => erros.push(args)
    const { container } = render(<Historia />)
    console.error = original
    expect(erros).toEqual([])
    const resultado = await axe.run(container, {
      rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
    })
    const violacoes = resultado.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html.slice(0, 80)).join(" | ")}`)
    expect(violacoes).toEqual([])
    cleanup()
  })
})
