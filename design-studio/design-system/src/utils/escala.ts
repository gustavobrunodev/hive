/** Escala "bonita" com uns 4 passos (1, 2, 2.5, 5 ou 10 × 10^k) até cobrir o máximo. */
export function escalaBonita(maximo: number): { passo: number; topo: number } {
  const bruto = Math.max(maximo, 1) / 4
  const magnitude = Math.pow(10, Math.floor(Math.log10(Math.max(1, bruto))))
  const passo = ([1, 2, 2.5, 5, 10].find((m) => m * magnitude >= bruto) ?? 10) * magnitude
  return { passo, topo: Math.max(passo, Math.ceil(maximo / passo) * passo) }
}

/** De quantos em quantos rótulos do eixo x mostrar para cada um ter ~52px. */
export function passoDosRotulos(quantidade: number, larguraUtil: number): number {
  return Math.max(1, Math.ceil(quantidade / Math.max(2, Math.floor(larguraUtil / 52))))
}
