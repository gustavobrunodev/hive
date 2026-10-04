import { readFileSync } from "node:fs"
import { join } from "node:path"
import { corNoTema, razaoDeContraste } from "./contraste"
import { gerarTokensCss } from "./css"
import { cores, espacos, excecoesDeContraste, layout, paresDeContraste, raios, sombras, type Tema } from "./tokens"
import { icones, nomesDosIcones } from "../icones/icones"

const TEMAS: Tema[] = ["claro", "escuro"]

describe("tokens", () => {
  it("src/tokens.css está em dia com tokens.ts (rode npm run build)", () => {
    const arquivo = readFileSync(join(__dirname, "..", "tokens.css"), "utf8")
    expect(arquivo).toBe(gerarTokensCss())
  })

  it("nomes únicos entre todas as famílias (a Claude Design usa um só espaço de nomes)", () => {
    const nomes = [...cores, ...sombras, ...raios, ...espacos, ...layout].map((t) => t.nome)
    expect(new Set(nomes).size).toBe(nomes.length)
    for (const n of nomes) expect(n).toMatch(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/)
  })

  it("toda cor tem valor hex válido e nota de uso", () => {
    for (const c of cores) {
      expect(c.claro, c.nome).toMatch(/^#[0-9a-f]{6}$|^rgba?\(/)
      if (c.escuro) expect(c.escuro, c.nome).toMatch(/^#[0-9a-f]{6}$|^rgba?\(/)
      expect(c.uso.length, c.nome).toBeGreaterThan(10)
    }
  })

  it.each(TEMAS)("tema %s: todo par prometido passa o mínimo", (tema) => {
    const falhas = paresDeContraste
      .filter((p) => !corNoTema(p.frente, tema).startsWith("rgba") && !corNoTema(p.fundo, tema).startsWith("rgba"))
      .map((p) => ({ ...p, razao: razaoDeContraste(corNoTema(p.frente, tema), corNoTema(p.fundo, tema)) }))
      .filter((p) => p.razao < p.minimo)
      .map((p) => `${p.frente} sobre ${p.fundo}: ${p.razao.toFixed(2)} < ${p.minimo} (${p.onde})`)
    expect(falhas).toEqual([])
  })

  it("as exceções documentadas continuam com o valor medido", () => {
    for (const e of excecoesDeContraste) {
      const razao = razaoDeContraste(corNoTema(e.frente, e.tema), corNoTema(e.fundo, e.tema))
      expect(razao, `${e.frente}/${e.fundo} no ${e.tema}`).toBeCloseTo(e.medido, 2)
    }
  })

  it("texto branco na pílula Alto passa nos dois temas", () => {
    for (const tema of TEMAS) expect(razaoDeContraste("#ffffff", corNoTema("critico", tema))).toBeGreaterThan(4.5)
  })

  it("contraste: cores curtas, inválidas e tokens desconhecidos", () => {
    expect(razaoDeContraste("#fff", "#000")).toBeCloseTo(21, 0)
    expect(() => razaoDeContraste("#zzz", "#000")).toThrow("cor inválida")
    expect(() => corNoTema("nao-existe", "claro")).toThrow("token de cor desconhecido")
    expect(corNoTema("marca-claude", "escuro")).toBe(corNoTema("marca-claude", "claro"))
  })
})

describe("ícones", () => {
  it("67 ícones, todos com desenho", () => {
    expect(nomesDosIcones).toHaveLength(67)
    for (const n of nomesDosIcones) expect(icones[n], n).toMatch(/^<(path|circle|rect)/)
  })
})
