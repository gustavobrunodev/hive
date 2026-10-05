#!/usr/bin/env node
// Skill relatorio-likert — o que é próprio do Likert. O resto está em comum.mjs.
import { executar, porcento } from './comum.mjs'

/** A parte das menções de uma Dor que veio com nota 1 ou 2. */
function parteRuim(grupo) {
  const ruim = grupo.linhas.filter((linha) => linha.nota <= 2).reduce((s, l) => s + l.peso, 0)
  return grupo.peso > 0 ? ruim / grupo.peso : 0
}

export const LIKERT = {
  id: 'likert',
  nome: 'Likert',
  unidade: 'respostas',
  unidadeDor: 'menções',
  metodo:
    'Comentários agrupados por tema; uma menção conta uma vez por resposta. Notas 1 e 2 pesam no impacto: alto a partir de 75% das menções com nota 1 ou 2, médio a partir de 50%.',
  impacto(grupo) {
    const ruim = parteRuim(grupo)
    if (ruim >= 0.75) return 'alto'
    return ruim >= 0.5 ? 'medio' : 'baixo'
  },
  extras() {
    return {}
  },
  /** Os comentários de nota mais baixa, os mais recentes primeiro. */
  evidencias(grupo, quando, data) {
    return grupo.linhas
      .filter((linha) => typeof linha.texto === 'string')
      .sort((a, b) => a.nota - b.nota || a.diasAtras - b.diasAtras)
      .slice(0, 3)
      .map((linha) => ({
        id: linha.id,
        data: data(quando(linha.diasAtras)),
        nota: linha.nota,
        texto: linha.texto,
        canal: linha.canal,
        perfil: linha.perfil
      }))
  },
  destaque(dados, frente) {
    const ruim = dados.registros.filter((linha) => linha.nota <= 2).reduce((s, l) => s + l.peso, 0)
    return `${porcento(ruim, frente.volume)}% das respostas com nota 1 ou 2`
  }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop())) {
  executar(LIKERT)
}
