import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import * as lib from "../../src"

/* O pacote e as convenções que a sincronização com a Claude Design espera. */

const COMPONENTES = join(__dirname, "../../src/components")
const pastas = readdirSync(COMPONENTES)
const GRUPOS = ["Marca e ícones", "Agentes", "Ações", "Seleção", "Rótulos", "Entrada", "Navegação", "Quadro", "Modo ao vivo", "Conversa", "Avisos", "Superfícies", "Dados"]

describe("pacote", () => {
  it("exporta cada componente principal como função ou ref", () => {
    for (const pasta of pastas) {
      const exportado = (lib as Record<string, unknown>)[pasta === "BarraDeFerramentas" ? "BarraFlutuante" : pasta === "Inserir" ? "VagaDeInsercao" : pasta]
      expect(exportado, pasta).toBeDefined()
      expect(["function", "object"]).toContain(typeof exportado)
    }
  })

  it("nenhuma exportação vazia", () => {
    for (const [nome, valor] of Object.entries(lib)) expect(valor, nome).toBeDefined()
  })

  it("expõe tokens e ícones para quem desenha em JS", () => {
    expect(lib.cores.find((c) => c.nome === "graf-enfase")?.claro).toBe("#ec7000")
    expect(lib.nomesDosIcones).toContain("inserir")
    expect(lib.razaoDeContraste("#1a1a1a", "#ffffff")).toBeGreaterThan(17)
  })

  it.each(pastas)("%s tem tsx, css, teste, README e história Vitrine com grupo conhecido", (pasta) => {
    const dir = join(COMPONENTES, pasta)
    for (const ext of [".tsx", ".css", ".test.tsx", ".stories.tsx"]) expect(existsSync(join(dir, pasta + ext)), pasta + ext).toBe(true)
    const leia = readFileSync(join(dir, "README.md"), "utf8")
    expect(leia).not.toMatch(/^# /)
    expect(leia.length).toBeGreaterThan(200)
    const historias = readFileSync(join(dir, `${pasta}.stories.tsx`), "utf8")
    const grupo = /title: "([^/]+)\//.exec(historias)?.[1]
    expect(GRUPOS).toContain(grupo)
    expect(historias).toMatch(/export const Vitrine: Story/)
    expect(historias).toMatch(/claudeDesign: \{ altura: \d+/)
  })

  it("nenhum CSS de componente usa classe sem o prefixo dst-", () => {
    for (const pasta of pastas) {
      const css = readFileSync(join(COMPONENTES, pasta, `${pasta}.css`), "utf8")
      const classes = [...css.matchAll(/\.([a-z][a-z0-9_-]*)/gi)].map((m) => m[1]!).filter((c) => !/^\d/.test(c))
      const fora = classes.filter((c) => !c.startsWith("dst-") && c !== "num")
      expect(fora, pasta).toEqual([])
    }
  })

  it("nenhum hex de cor solto além dos que o app usa de propósito", () => {
    const permitidos = new Set(["#fff", "#ffffff", "#a34c00", "#ececea", "#cfcfc8", "#5c5c55", "#c4291c", "#9a6a00", "#8f1d12", "#135c3a"])
    for (const pasta of pastas) {
      const css = readFileSync(join(COMPONENTES, pasta, `${pasta}.css`), "utf8")
      const hexes = [...css.matchAll(/#[0-9a-f]{3,8}\b/gi)].map((m) => m[0].toLowerCase())
      expect(hexes.filter((h) => !permitidos.has(h)), pasta).toEqual([])
    }
  })
})
