// Design Studio — o núcleo comum das três skills de relatório.
//
// Cópia idêntica em `relatorio-likert`, `relatorio-voz` e `relatorio-fullstory`
// (um teste do app confere): cada skill é autossuficiente, porque o porte
// (ADR 0001) troca uma skill de cada vez. O que muda por Fonte está no
// `relatorio.mjs` ao lado.
//
// Entrada: o arquivo de dados de exemplo (registros brutos ponderados).
// Saída: o Relatório de Fonte no formato `relatorio-de-fonte/1` — Markdown
// com front matter YAML — numa cópia de trabalho que o app valida e publica.
// Progresso: `<saida>.progresso` com `{"passo": n}` (1 lendo, 2 agrupando,
// 3 ranqueando, 4 rascunho gravado). Sem dependências: roda com o `node`.

import { readFileSync, writeFileSync } from 'node:fs'
import { relative, resolve, sep } from 'node:path'

const SEMANAS = 13
const DIA = 86400000

/** `--chave valor` da linha de comando. */
export function lerArgumentos(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[i + 1] ?? ''
  }
  return args
}

/** Só grava dentro de `<cwd>/relatorios`: o turno do módulo não escreve em outro lugar. */
export function saidaPermitida(saida, cwd = process.cwd()) {
  const raiz = resolve(cwd, 'relatorios')
  const alvo = resolve(cwd, saida)
  const caminho = relative(raiz, alvo)
  return (
    caminho !== '' &&
    !caminho.startsWith('..') &&
    !caminho.startsWith(sep) &&
    !/^[a-zA-Z]:/.test(caminho)
  )
}

function dataISO(ms) {
  const d = new Date(ms)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`
}

/** Hoje (AAAA-MM-DD, hora local) como meia-noite UTC, para contar dias sem fuso. */
function hojeMs(hoje) {
  if (hoje) {
    const [a, m, d] = hoje.split('-').map(Number)
    return Date.UTC(a, m - 1, d)
  }
  const agora = new Date()
  return Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate())
}

export function formatar(n) {
  return Number(n).toLocaleString('pt-BR')
}

export function porcento(parte, total) {
  return total > 0 ? Math.round((parte / total) * 100) : 0
}

/** A semana (0 = a mais antiga, 12 = a atual) de uma linha. */
function semanaDe(diasAtras) {
  return Math.max(0, Math.min(SEMANAS - 1, SEMANAS - 1 - Math.floor(diasAtras / 7)))
}

/** As 6 últimas semanas sobre as 6 primeiras, em %. */
export function tendencia(semanas) {
  const antes = semanas.slice(0, 6).reduce((a, b) => a + b, 0)
  const depois = semanas.slice(SEMANAS - 6).reduce((a, b) => a + b, 0)
  return antes > 0 ? Math.round((depois / antes - 1) * 100) : 0
}

function tendenciaTexto(t) {
  if (t === 0) return 'estável'
  return t > 0 ? `alta de ${t}%` : `queda de ${Math.abs(t)}%`
}

/** Agrupa os registros por tema: soma de pesos, série semanal e as linhas do grupo. */
export function agrupar(dados) {
  const grupos = new Map(
    dados.temas.map((tema) => [
      tema.id,
      { tema, peso: 0, semanas: new Array(SEMANAS).fill(0), linhas: [] }
    ])
  )
  for (const linha of dados.registros) {
    const grupo = linha.tema === null ? undefined : grupos.get(linha.tema)
    if (!grupo) continue
    grupo.peso += linha.peso
    grupo.semanas[semanaDe(linha.diasAtras)] += linha.peso
    grupo.linhas.push(linha)
  }
  return [...grupos.values()].filter((grupo) => grupo.peso > 0)
}

/** Ranqueia por volume (no empate, pelo id), do maior para o menor. */
export function ranquear(grupos) {
  return [...grupos].sort((a, b) => b.peso - a.peso || a.tema.id.localeCompare(b.tema.id))
}

/* ---------------------------------------------------------------- YAML -- */

function escalar(valor) {
  if (valor === null || valor === undefined) return 'null'
  if (typeof valor === 'number' || typeof valor === 'boolean') return String(valor)
  return JSON.stringify(String(valor))
}

function eEscalar(valor) {
  return valor === null || typeof valor !== 'object'
}

/** YAML em bloco, com toda string entre aspas duplas (o subconjunto que o JSON também é). */
export function yaml(valor, recuo = '') {
  if (Array.isArray(valor)) {
    if (valor.length === 0) return '[]'
    return valor
      .map((item) => {
        if (eEscalar(item)) return `${recuo}- ${escalar(item)}`
        const corpo = yaml(item, `${recuo}  `)
        return `${recuo}- ${corpo.slice(recuo.length + 2)}`
      })
      .join('\n')
  }
  return Object.entries(valor)
    .filter(([, v]) => v !== undefined)
    .map(([chave, v]) => {
      if (eEscalar(v)) return `${recuo}${chave}: ${escalar(v)}`
      if (Array.isArray(v) && v.length === 0) return `${recuo}${chave}: []`
      return `${recuo}${chave}:\n${yaml(v, `${recuo}  `)}`
    })
    .join('\n')
}

/* ------------------------------------------------------------- Relatório -- */

function categorias(dados, dores, fonte) {
  const total = dores.reduce((soma, dor) => soma + dor.volume, 0)
  return dados.categorias
    .map((categoria) => {
      const delas = dores.filter((dor) => dor.categoria === categoria.id)
      if (delas.length === 0) return null
      const volume = delas.reduce((soma, dor) => soma + dor.volume, 0)
      const semanas = new Array(SEMANAS).fill(0)
      for (const dor of delas) dor.semanas.forEach((v, i) => (semanas[i] += v))
      const topo = delas[0]
      return {
        id: categoria.id,
        nome: categoria.nome,
        volume,
        participacao: porcento(volume, total),
        semanas,
        insight: `${categoria.padrao} A Dor que mais pesa é “${topo.titulo}”, com ${formatar(topo.volume)} ${fonte.unidadeDor}. Próximo passo: ${categoria.sugestao}`
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.volume - a.volume)
}

function narrativa(dados, dores, frente, fonte) {
  const soma = dores.reduce((total, dor) => total + dor.volume, 0)
  const [topo, segunda] = dores
  const cresce = [...dores].sort((a, b) => b.tendencia - a.tendencia)[0]
  const destaque = frente.destaque.charAt(0).toUpperCase() + frente.destaque.slice(1)
  const paragrafos = [
    `Em 90 dias, ${formatar(frente.volume)} ${fonte.unidade} de ${dados.produto} chegaram pela Fonte ${fonte.nome}. ${destaque}. As ${dores.length} Dores ranqueadas somam ${formatar(soma)} ${fonte.unidadeDor}.`,
    `A Dor que lidera é “${topo.titulo}”, com ${formatar(topo.volume)} ${fonte.unidadeDor} e ${tendenciaTexto(topo.tendencia)} no período. ${topo.resumo}`
  ]
  if (cresce && cresce.id !== topo.id) {
    paragrafos.push(
      `A que mais cresce é “${cresce.titulo}” (${tendenciaTexto(cresce.tendencia)}). ${cresce.resumo}`
    )
  } else if (segunda) {
    paragrafos.push(
      `Em seguida vem “${segunda.titulo}”, com ${formatar(segunda.volume)} ${fonte.unidadeDor}. ${segunda.resumo}`
    )
  }
  return paragrafos
}

/**
 * O Relatório inteiro, a partir dos dados: front matter e parágrafos da
 * narrativa. `fonte` traz o que muda por Fonte (`relatorio.mjs`).
 */
export function montarRelatorio(dados, fonte, opcoes) {
  const hoje = hojeMs(opcoes.hoje)
  const ranqueados = ranquear(agrupar(dados))
  const topo = ranqueados[0]?.peso ?? 0
  const dores = ranqueados.map((grupo, i) => {
    const t = grupo.tema
    return {
      id: t.id,
      rank: i + 1,
      titulo: t.titulo,
      resumo: t.resumo,
      ...(t.tela ? { tela: t.tela } : {}),
      categoria: t.categoria,
      volume: grupo.peso,
      impacto: fonte.impacto(grupo, topo),
      tendencia: tendencia(grupo.semanas),
      semanas: grupo.semanas,
      ...fonte.extras(grupo),
      evidencias: fonte.evidencias(grupo, (diasAtras) => hoje - diasAtras * DIA, dataISO)
    }
  })
  const volume = dados.registros.reduce((soma, linha) => soma + linha.peso, 0)
  const frente = {
    formato: 'relatorio-de-fonte/1',
    produto: dados.produto,
    fonte: fonte.id,
    periodo: { inicio: dataISO(hoje - 89 * DIA), fim: dataISO(hoje), dias: 90 },
    geradoEm: new Date().toISOString(),
    geradoPor: { agente: opcoes.agente || 'Agente', modelo: opcoes.modelo || null },
    volume,
    destaque: '',
    metodo: fonte.metodo,
    dores,
    categorias: []
  }
  frente.categorias = categorias(dados, dores, fonte)
  frente.destaque = fonte.destaque(dados, frente)
  return { frente, narrativa: narrativa(dados, dores, frente, fonte) }
}

export function markdown({ frente, narrativa }) {
  return `---\n${yaml(frente)}\n---\n\n${narrativa.join('\n\n')}\n`
}

/** Roda a skill: lê, agrupa, ranqueia, grava o rascunho, e anota cada passo. */
export function executar(fonte, argv = process.argv.slice(2)) {
  const args = lerArgumentos(argv)
  if (!args.dados || !args.saida) {
    process.stderr.write(
      'Uso: node relatorio.mjs --dados <arquivo.json> --saida <arquivo> [--agente <nome>] [--modelo <id>]\n'
    )
    process.exit(2)
  }
  if (!saidaPermitida(args.saida)) {
    process.stderr.write(`A saída precisa ficar dentro de ${resolve('relatorios')}.\n`)
    process.exit(2)
  }
  const progresso = (passo) =>
    writeFileSync(`${args.saida}.progresso`, JSON.stringify({ passo }), 'utf-8')
  progresso(1)
  const dados = JSON.parse(readFileSync(args.dados, 'utf-8'))
  progresso(2)
  const relatorio = montarRelatorio(dados, fonte, args)
  progresso(3)
  writeFileSync(args.saida, markdown(relatorio), 'utf-8')
  progresso(4)
  process.stdout.write(
    `Rascunho gravado em ${args.saida}: ${relatorio.frente.dores.length} Dores ranqueadas.\n`
  )
}
