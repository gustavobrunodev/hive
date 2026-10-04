import { cores, type Tema } from "./tokens"

function luminancia(hex: string): number {
  let h = hex.replace("#", "")
  if (h.length === 3) h = [...h].map((c) => c + c).join("")
  if (!/^[0-9a-f]{6}$/i.test(h)) throw new Error(`cor inválida: ${hex}`)
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Razão de contraste WCAG 2 entre duas cores hex. */
export function razaoDeContraste(a: string, b: string): number {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x) as [number, number]
  return (claro + 0.05) / (escuro + 0.05)
}

/** O valor de um token de cor num tema; o escuro herda o claro quando não muda. */
export function corNoTema(nome: string, tema: Tema): string {
  const token = cores.find((c) => c.nome === nome)
  if (!token) throw new Error(`token de cor desconhecido: ${nome}`)
  return tema === "escuro" ? token.escuro ?? token.claro : token.claro
}
