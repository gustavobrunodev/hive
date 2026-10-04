const inteiro = new Intl.NumberFormat("pt-BR")

/** 1796 → "1.796". */
export function formatarNumero(valor: number): string {
  return inteiro.format(valor)
}

/** Parte de um total em porcentagem inteira; 0 quando o total é zero. */
export function porcentagem(parte: number, total: number): number {
  return total > 0 ? Math.round((parte / total) * 100) : 0
}
