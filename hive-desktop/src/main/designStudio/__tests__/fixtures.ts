import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { stringify } from 'yaml'

/**
 * Design Studio test fixtures: a Relatório de Fonte as decision 4 writes one,
 * and the file on disk where decision 3 puts it. Shared by the main suites;
 * under `__tests__/` so coverage does not count it as module code.
 */

export type Frente = Record<string, unknown>

/** A complete, valid front matter for `produto`/`fonte`, with `dores` Dores. */
export function frenteValida(
  overrides: Frente = {},
  options: { produto?: string; fonte?: string; dores?: number } = {}
): Frente {
  const produto = options.produto ?? 'Extrato'
  const fonte = options.fonte ?? 'likert'
  const quantas = options.dores ?? 6
  const dores = Array.from({ length: quantas }, (_, i) => ({
    id: `dor-${i + 1}`,
    rank: i + 1,
    titulo: `Dor número ${i + 1}`,
    resumo: `O que a Dor ${i + 1} conta.`,
    tela: i % 3 === 2 ? undefined : 'Período',
    categoria: i % 2 === 0 ? 'historico' : 'busca',
    volume: 1000 - i * 100,
    impacto: ['alto', 'medio', 'baixo'][i % 3],
    tendencia: 10 - i * 3,
    semanas: [7, 7, 7, 7, 7, 7, 8, 8, 8, 8, 8, 8, 9],
    evidencias: [
      {
        id: `LK-${i}`,
        data: '2026-09-20',
        nota: 1,
        texto: 'Comentário.',
        canal: 'App iOS',
        perfil: 'Pessoa física'
      }
    ]
  }))
  return {
    formato: 'relatorio-de-fonte/1',
    produto,
    fonte,
    periodo: { inicio: '2026-07-07', fim: '2026-10-04', dias: 90 },
    geradoEm: '2026-10-04T12:00:00.000Z',
    geradoPor: { agente: 'Claude', modelo: 'sonnet' },
    volume: 18240,
    destaque: '31% das respostas com nota 1 ou 2',
    metodo: 'Comentários agrupados por tema.',
    dores,
    categorias: [
      {
        id: 'historico',
        nome: 'Período e histórico',
        volume: 2400,
        participacao: 60,
        semanas: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
        insight: 'O limite de 90 dias pesa.'
      }
    ],
    ...overrides
  }
}

/** The file's text: front matter, then the narrative's paragraphs. */
export function relatorioTexto(
  frente: Frente,
  narrativa: string[] = ['Primeiro parágrafo.', 'Segundo parágrafo.']
): string {
  return `---\n${stringify(frente)}---\n\n${narrativa.join('\n\n')}\n`
}

/** Writes a Relatório into `<root>/<produto>/relatorios/<fonte>/<arquivo>`; returns its full path. */
export function gravarRelatorio(
  root: string,
  produto: string,
  fonte: string,
  arquivo: string,
  texto: string
): string {
  const dir = join(root, produto, 'relatorios', fonte)
  mkdirSync(dir, { recursive: true })
  const path = join(dir, arquivo)
  writeFileSync(path, texto, 'utf-8')
  return path
}
