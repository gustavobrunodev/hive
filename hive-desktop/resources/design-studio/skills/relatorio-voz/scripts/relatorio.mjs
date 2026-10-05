#!/usr/bin/env node
// Skill relatorio-voz — o que é próprio da Voz do Cliente. O resto está em comum.mjs.
import { executar, porcento } from './comum.mjs'

/** % das ligações de uma Dor em que o cliente ligou de novo em até 7 dias. */
function rechamada(grupo) {
  const de_novo = grupo.linhas.filter((linha) => linha.rechamada).reduce((s, l) => s + l.peso, 0)
  return porcento(de_novo, grupo.peso)
}

export const VOZ = {
  id: 'voz',
  nome: 'Voz do Cliente',
  unidade: 'ligações',
  unidadeDor: 'ligações',
  metodo:
    'Ligações agrupadas pelo motivo registrado no atendimento. Rechamada é uma nova ligação do mesmo cliente em até 7 dias; impacto alto a partir de 20% de rechamada, médio a partir de 10%.',
  impacto(grupo) {
    const r = rechamada(grupo)
    if (r >= 20) return 'alto'
    return r >= 10 ? 'medio' : 'baixo'
  },
  extras(grupo) {
    return { rechamada: rechamada(grupo) }
  },
  /** As transcrições, primeiro as de quem ligou de novo, as mais recentes primeiro. */
  evidencias(grupo, quando, data) {
    return grupo.linhas
      .filter((linha) => Array.isArray(linha.trechos))
      .sort((a, b) => Number(b.rechamada) - Number(a.rechamada) || a.diasAtras - b.diasAtras)
      .slice(0, 3)
      .map((linha) => ({
        id: linha.id,
        data: `${data(quando(linha.diasAtras))}T${linha.hora}`,
        duracao: linha.duracao,
        motivo: grupo.tema.motivo,
        rechamada: linha.rechamada,
        trechos: linha.trechos
      }))
  },
  destaque(_dados, frente) {
    const topo = frente.categorias[0]
    if (!topo) return 'Nenhuma ligação ligada a uma Dor no período'
    return `${porcento(topo.volume, frente.volume)}% das ligações tratam de ${topo.nome.toLowerCase()}`
  }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop())) {
  executar(VOZ)
}
