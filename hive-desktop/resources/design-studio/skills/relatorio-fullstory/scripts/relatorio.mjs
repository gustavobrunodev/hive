#!/usr/bin/env node
// Skill relatorio-fullstory — o que é próprio do FullStory. O resto está em comum.mjs.
import { executar } from './comum.mjs'

export const FULLSTORY = {
  id: 'fullstory',
  nome: 'FullStory',
  unidade: 'sessões',
  unidadeDor: 'clientes afetados',
  metodo:
    'Sinais nativos do FullStory (rage, dead e error click, cursor agitado, abandono de formulário), contados por cliente único. Impacto pela proporção da Dor que mais afeta: alto a partir de metade dela, médio a partir de um quinto.',
  impacto(grupo, topo) {
    const parte = topo > 0 ? grupo.peso / topo : 0
    if (parte >= 0.5) return 'alto'
    return parte >= 0.2 ? 'medio' : 'baixo'
  },
  extras(grupo) {
    return { sinal: grupo.tema.sinal }
  },
  /** As sessões com o que aconteceu descrito, as mais recentes primeiro. */
  evidencias(grupo, quando, data) {
    return grupo.linhas
      .filter((linha) => typeof linha.detalhe === 'string')
      .sort((a, b) => a.diasAtras - b.diasAtras)
      .slice(0, 3)
      .map((linha) => ({
        id: linha.id,
        data: data(quando(linha.diasAtras)),
        dispositivo: linha.dispositivo,
        tela: grupo.tema.tela,
        elemento: grupo.tema.elemento,
        sinal: grupo.tema.sinal,
        momento: linha.momento,
        detalhe: linha.detalhe
      }))
  },
  destaque(dados, frente) {
    const comSinal = dados.registros.filter((linha) => linha.tema !== null).reduce((s, l) => s + l.peso, 0)
    const parte = frente.volume > 0 ? (comSinal / frente.volume) * 100 : 0
    return `${parte.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% das sessões com sinal de frustração`
  }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop())) {
  executar(FULLSTORY)
}
