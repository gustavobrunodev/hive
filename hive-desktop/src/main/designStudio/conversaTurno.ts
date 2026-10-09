import { randomUUID } from 'crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { basename, extname, join } from 'path'
import type { AgentEvent, TurnScope } from '../agentAdapter'
import type { ChatHistoryStore, StoredChatSession } from '../chatHistoryStore'
import type { Catalogo } from './catalogo'
import type { RelatorioDeFonte } from './relatorioFormato'
import { latestRelatorio, relatorioAt } from './relatorios'

/**
 * Design Studio — a turn of the conversa do Produto (criteria 10–18), from the
 * plan to the reply on disk.
 *
 * The renderer starts the turn (`agent.send` with the plan's prompt, scope and
 * session); this service plans it and owns everything around it. It creates the
 * conversation when there is none yet, records the person's message, copies the
 * attachments to where the scoped turn may read them, and builds the prompt
 * from the Produto's most recent Relatórios. Then it watches the agent's
 * events for that turn alone. Only the reply's text leaves it, on the module's
 * own channel (`designStudio:conversa`): a tool call, a permission question, a
 * thought or a path never reaches the conversation (PRODUCT, "Esconder a
 * máquina").
 *
 * A module conversation is an ordinary history session whose workspace key is
 * `<raiz>/<Produto>` (lote 1), so Recentes lists it with no extra index.
 */

/** A Dor the person cited: the Relatório file (relative to `<raiz>`) and the Dor's id. */
export interface DorCitadaNoPedido {
  relatorio: string
  dor: string
}

/** What the person sent, and the agent that will answer it. */
export interface PedidoDeConversa {
  /** The Produto's name — its folder in `<raiz>`. */
  produto: string
  /** The conversation it continues, or `null` to start one. */
  conversa: string | null
  texto: string
  /** The new conversation's title (criterion 10); ignored when continuing one. */
  titulo: string
  citadas: DorCitadaNoPedido[]
  /** Relatórios attached from the + menu, by `caminho` (criterion 8). */
  relatoriosAnexados: string[]
  /** Files attached from the computer, by absolute path (criterion 7). */
  anexos: Array<{ path: string; name: string }>
  agente: { id: string; modelo: string | null }
}

export type PlanoDeConversa =
  | {
      ok: true
      conversa: string
      turnId: string
      prompt: string
      scope: TurnScope
      resume: string | null
      freshSession: boolean
      /** The copies the turn reads, in the order they were attached. */
      anexos: string[]
    }
  | { ok: false; motivo: 'ocupado' | 'desconhecida' }

/** One step of a turn's life, pushed to every window (`designStudio:conversa`). */
export type EventoDeConversa = { turnId: string; produto: string; conversa: string } & (
  | { estado: 'escrevendo'; texto: string }
  | { estado: 'pronto' | 'parado'; texto: string; agente: string; modelo: string | null }
  /** `erro` is the agent's own message, for the renderer to *classify* (the account lane) — never to show. */
  | { estado: 'falhou'; erro: string }
)

/** A stored message, as a reopened conversation draws it (criterion 16). */
export interface MensagemGuardada {
  id: string
  papel: 'pessoa' | 'agente'
  texto: string
  anexos: string[]
  agente: string | null
  modelo: string | null
  em: number
}

export interface ConversaGuardada {
  id: string
  produto: string
  titulo: string
  mensagens: MensagemGuardada[]
}

export interface ConversaDeps {
  /** `<raiz>`. */
  root: string
  store: ChatHistoryStore
  catalogo: () => Catalogo
  emit: (evento: EventoDeConversa) => void
  newTurnId?: () => string
}

export interface ServicoDeConversa {
  plan(pedido: PedidoDeConversa): PlanoDeConversa
  /**
   * Starts a conversation with the person's line and no turn — the guided first
   * Relatório (criterion 3), where the app asks the question itself. `null`
   * for a Produto the catalog does not know.
   */
  iniciar(produto: string, texto: string, titulo: string): string | null
  ler(produto: string, conversa: string): ConversaGuardada | null
  onAgentEvent(event: AgentEvent): void
  /** The send never reached an agent: forget the turn. */
  abandon(turnId: string): void
  /** Every session was stopped (`agent:stop`): each turn in flight ends where it is. */
  interrupt(): void
}

/** The folder a scoped turn may read: the Produto's Relatórios, and nothing else (criterion 18). */
export function relatoriosRoot(root: string, produto: string): string {
  return join(root, produto, 'relatorios')
}

/** The scope of a conversa do Produto turn: its folder, reading only `relatorios/`, no writing, no command. */
export function conversaScope(root: string, produto: string): TurnScope {
  return {
    cwd: join(root, produto),
    readRoots: [relatoriosRoot(root, produto)],
    writeRoots: [],
    commands: []
  }
}

/** Where a conversation's attachments are copied: inside the turn's one read root. */
export function anexosDir(root: string, produto: string, conversa: string): string {
  return join(relatoriosRoot(root, produto), '.anexos', conversa)
}

/** A file name with no folder in it, never empty. */
function nomeSeguro(nome: string, padrao: string): string {
  const limpo = basename(nome.replace(/\\/g, '/')).trim()
  return limpo === '' || limpo === '.' || limpo === '..' ? padrao : limpo
}

/** `nome` in `dir`, or `nome (2).ext`, `(3)`… — the first one not taken. */
function nomeLivre(dir: string, nome: string): string {
  if (!existsSync(join(dir, nome))) return nome
  const ext = extname(nome)
  const stem = nome.slice(0, nome.length - ext.length)
  for (let n = 2; ; n += 1) {
    const candidato = `${stem} (${n})${ext}`
    if (!existsSync(join(dir, candidato))) return candidato
  }
}

/** Copies the attachments into the conversation's folder. A file that cannot be copied is left out. */
export function copiarAnexos(
  dir: string,
  anexos: ReadonlyArray<{ path: string; name: string }>
): string[] {
  if (anexos.length === 0) return []
  mkdirSync(dir, { recursive: true })
  return anexos.flatMap((anexo) => {
    const destino = join(dir, nomeLivre(dir, nomeSeguro(anexo.name, 'anexo')))
    try {
      copyFileSync(anexo.path, destino)
      return [destino]
    } catch {
      return []
    }
  })
}

/**
 * A print pasted with Ctrl+V (criterion 7): its bytes, written to a folder of
 * its own so it can be attached like any file. Answers what the field's tray
 * draws.
 */
export function guardarColado(
  dir: string,
  nome: string,
  bytes: Uint8Array
): { path: string; name: string; size: number } {
  const pasta = join(dir, randomUUID())
  mkdirSync(pasta, { recursive: true })
  const name = nomeSeguro(nome, 'print-colado.png')
  const path = join(pasta, name)
  writeFileSync(path, bytes)
  return { path, name, size: bytes.byteLength }
}

const NIVEL: Record<string, string> = { alto: 'alto', medio: 'médio', baixo: 'baixo' }

/** One Relatório as the turn reads it: highlight, narrative, then the ranked Dores with their ids. */
function blocoDoRelatorio(relatorio: RelatorioDeFonte, fonteNome: string): string {
  const dores = [...relatorio.dores]
    .sort((a, b) => a.rank - b.rank)
    .map((dor) => {
      const tela = dor.tela ? `, tela ${dor.tela}` : ''
      return `${dor.rank}. [${dor.id}] ${dor.titulo} — impacto ${NIVEL[dor.impacto] ?? dor.impacto}, volume ${dor.volume}, tendência ${dor.tendencia}%, categoria ${dor.categoria}${tela}. ${dor.resumo}`
    })
  return [
    `## ${fonteNome} · gerado em ${relatorio.geradoEm} · ${relatorio.volume} registros no período`,
    `Destaque: ${relatorio.destaque}`,
    '',
    'Narrativa:',
    relatorio.narrativa.join('\n\n'),
    '',
    'Dores ranqueadas:',
    ...dores
  ].join('\n')
}

/**
 * The turn's text, sent on stdin (it spans lines). pt-BR, because the agent
 * answers a PM in it; it carries the Relatórios inline, so the turn never has
 * to read a file to know them.
 */
export function promptDaConversa(input: {
  produto: string
  relatorios: ReadonlyArray<{ relatorio: RelatorioDeFonte; fonteNome: string }>
  anexados: ReadonlyArray<{ titulo: string; texto: string }>
  citadas: ReadonlyArray<{ id: string; titulo: string }>
  texto: string
}): string {
  const partes = [
    `Você está no Design Studio, conversando com uma pessoa de produto sobre as Dores dos clientes do Produto ${input.produto}.`,
    'Responda em português do Brasil, em linguagem simples. Não fale de arquivos, caminhos, comandos, ferramentas, git nem MCP.',
    'Use só o que está nos Relatórios de Fonte abaixo e não invente números.',
    'Quando falar de uma Dor da lista, escreva a marca [[dor:<id>]] logo depois do título dela, com o id que aparece entre colchetes.',
    '',
    `# Relatórios de Fonte de ${input.produto}`,
    input.relatorios.length === 0
      ? `${input.produto} ainda não tem Relatórios de Fonte.`
      : input.relatorios.map((r) => blocoDoRelatorio(r.relatorio, r.fonteNome)).join('\n\n')
  ]
  if (input.anexados.length > 0) {
    partes.push('', '# Relatórios anexados pela pessoa')
    for (const anexado of input.anexados) partes.push(`## ${anexado.titulo}`, anexado.texto)
  }
  if (input.citadas.length > 0) {
    partes.push('', '# Dores citadas pela pessoa')
    for (const dor of input.citadas) partes.push(`- [${dor.id}] ${dor.titulo}`)
  }
  partes.push('', '# Mensagem da pessoa', input.texto)
  return partes.join('\n')
}

interface TurnoAtivo {
  turnId: string
  produto: string
  conversa: string
  workspace: string
  agente: string
  modelo: string | null
  texto: string
  cli: string | null
}

/** The CLI session the last stored reply ran on, when it was this agent's. */
function cliDaUltimaResposta(session: StoredChatSession, agente: string): string | null {
  const ultima = [...session.messages].reverse().find((m) => m.role === 'assistant')
  return ultima?.agent === agente ? session.cliSessionId || null : null
}

/** The most recent Relatório of each Fonte of `produto`, in the catalog's Fonte order (criterion 11). */
function relatoriosEmUso(
  deps: ConversaDeps,
  produto: string
): Array<{ relatorio: RelatorioDeFonte; fonteNome: string }> {
  return deps.catalogo().fontes.flatMap((fonte) => {
    const relatorio = latestRelatorio(deps.root, produto, fonte.id)
    return relatorio ? [{ relatorio, fonteNome: fonte.nome }] : []
  })
}

/** An attached Relatório: its file's whole text, under the name the person saw on its chip (criterion 8). */
function anexado(deps: ConversaDeps, caminho: string): { titulo: string; texto: string } | null {
  const relatorio = relatorioAt(deps.root, caminho)
  if (!relatorio) return null
  const fonte = deps.catalogo().fontes.find((entry) => entry.id === relatorio.fonte)
  try {
    return {
      titulo: `Relatório de ${fonte?.nome ?? relatorio.fonte} · ${relatorio.produto}`,
      texto: readFileSync(join(deps.root, caminho), 'utf-8')
    }
  } catch {
    return null
  }
}

/** The cited Dores, resolved to their titles; an id the Relatório no longer has is dropped. */
function citadasDe(
  deps: ConversaDeps,
  pedido: PedidoDeConversa
): Array<{ id: string; titulo: string }> {
  return pedido.citadas.flatMap((citada) => {
    const dor = relatorioAt(deps.root, citada.relatorio)?.dores.find((d) => d.id === citada.dor)
    return dor ? [{ id: dor.id, titulo: dor.titulo }] : []
  })
}

/** A stored session, as a reopened conversation draws it: the person's lines and the agent's replies. */
function lerSessao(session: StoredChatSession, produto: string): ConversaGuardada {
  return {
    id: session.id,
    produto,
    titulo: session.title,
    mensagens: session.messages.flatMap((m): MensagemGuardada[] =>
      m.role === 'compaction'
        ? []
        : [
            {
              id: m.id,
              papel: m.role === 'user' ? 'pessoa' : 'agente',
              texto: m.text,
              anexos: m.attachments ?? [],
              agente: m.agent ?? null,
              modelo: m.model ?? null,
              em: m.at
            }
          ]
    )
  }
}

export function createConversaService(deps: ConversaDeps): ServicoDeConversa {
  const newTurnId = deps.newTurnId ?? (() => `ds-conversa-${randomUUID()}`)
  const ativos = new Map<string, TurnoAtivo>()
  /** conversation → agent → that agent's CLI session, learned in this run. */
  const sessoes = new Map<string, Map<string, string>>()
  /** `conversation|agent` pairs that already asked the agent for a session in this run. */
  const pedidas = new Set<string>()

  const produtoDe = (nome: string): Catalogo['produtos'][number] | undefined =>
    deps.catalogo().produtos.find((entry) => entry.nome === nome)

  function sessaoPara(pedido: PedidoDeConversa, workspace: string): StoredChatSession | null {
    if (pedido.conversa === null) return deps.store.create(workspace, pedido.agente.id)
    return deps.store.get(workspace, pedido.conversa)
  }

  /** `resume` and `freshSession` for this conversation on this agent (Landing, resume per agent). */
  function sessaoDaCli(
    session: StoredChatSession,
    agente: string
  ): { resume: string | null; freshSession: boolean } {
    const resume = sessoes.get(session.id)?.get(agente) ?? cliDaUltimaResposta(session, agente)
    const chave = `${session.id}|${agente}`
    const freshSession = resume === null && !pedidas.has(chave)
    pedidas.add(chave)
    return { resume, freshSession }
  }

  function lembrarCli(conversa: string, agente: string, cli: string): void {
    const porAgente = sessoes.get(conversa) ?? new Map<string, string>()
    porAgente.set(agente, cli)
    sessoes.set(conversa, porAgente)
  }

  function base(ativo: TurnoAtivo): { turnId: string; produto: string; conversa: string } {
    return { turnId: ativo.turnId, produto: ativo.produto, conversa: ativo.conversa }
  }

  /** The turn ended with words: they are the reply, kept with who gave it. */
  function concluir(ativo: TurnoAtivo, estado: 'pronto' | 'parado'): void {
    ativos.delete(ativo.turnId)
    if (estado === 'pronto' && ativo.texto.trim() === '') {
      deps.emit({ ...base(ativo), estado: 'falhou', erro: '' })
      return
    }
    if (ativo.texto.trim() !== '') {
      deps.store.appendMessage(ativo.workspace, ativo.conversa, {
        role: 'assistant',
        text: ativo.texto,
        agent: ativo.agente,
        ...(ativo.modelo ? { model: ativo.modelo } : {})
      })
      // The stored session is always the last reply's agent's — empty when
      // that agent never named one, so no other agent can ever be handed it.
      const cli = ativo.cli ?? sessoes.get(ativo.conversa)?.get(ativo.agente) ?? ''
      deps.store.setCliSession(ativo.workspace, ativo.conversa, cli)
    }
    deps.emit({
      ...base(ativo),
      estado,
      texto: ativo.texto,
      agente: ativo.agente,
      modelo: ativo.modelo
    })
  }

  return {
    plan(pedido: PedidoDeConversa): PlanoDeConversa {
      if (!produtoDe(pedido.produto)) return { ok: false, motivo: 'desconhecida' }
      if ([...ativos.values()].some((a) => a.conversa === pedido.conversa)) {
        return { ok: false, motivo: 'ocupado' }
      }
      const workspace = join(deps.root, pedido.produto)
      const session = sessaoPara(pedido, workspace)
      if (!session) return { ok: false, motivo: 'desconhecida' }
      const nova = session.title === ''
      deps.store.appendMessage(workspace, session.id, {
        role: 'user',
        text: pedido.texto,
        attachments: pedido.anexos.map((anexo) => anexo.name)
      })
      if (nova) deps.store.rename(workspace, session.id, pedido.titulo)
      const anexos = copiarAnexos(anexosDir(deps.root, pedido.produto, session.id), pedido.anexos)
      const prompt = promptDaConversa({
        produto: pedido.produto,
        relatorios: relatoriosEmUso(deps, pedido.produto),
        anexados: pedido.relatoriosAnexados.flatMap((caminho) => anexado(deps, caminho) ?? []),
        citadas: citadasDe(deps, pedido),
        texto: pedido.texto
      })
      const turnId = newTurnId()
      ativos.set(turnId, {
        turnId,
        produto: pedido.produto,
        conversa: session.id,
        workspace,
        agente: pedido.agente.id,
        modelo: pedido.agente.modelo,
        texto: '',
        cli: null
      })
      return {
        ok: true,
        conversa: session.id,
        turnId,
        prompt,
        scope: conversaScope(deps.root, pedido.produto),
        ...sessaoDaCli(session, pedido.agente.id),
        anexos
      }
    },

    iniciar(produto: string, texto: string, titulo: string): string | null {
      if (!produtoDe(produto)) return null
      const workspace = join(deps.root, produto)
      const session = deps.store.create(workspace, null)
      deps.store.appendMessage(workspace, session.id, { role: 'user', text: texto })
      deps.store.rename(workspace, session.id, titulo)
      return session.id
    },

    ler(produto: string, conversa: string): ConversaGuardada | null {
      if (!produtoDe(produto)) return null
      const session = deps.store.get(join(deps.root, produto), conversa)
      return session ? lerSessao(session, produto) : null
    },

    onAgentEvent(event: AgentEvent): void {
      const ativo = event.turnId === undefined ? undefined : ativos.get(event.turnId)
      if (!ativo) return
      switch (event.type) {
        case 'token':
          ativo.texto += event.text
          deps.emit({ ...base(ativo), estado: 'escrevendo', texto: ativo.texto })
          return
        case 'session':
          ativo.cli = event.id
          lembrarCli(ativo.conversa, ativo.agente, event.id)
          return
        case 'done':
          concluir(ativo, 'pronto')
          return
        case 'interrupted':
          concluir(ativo, 'parado')
          return
        case 'error':
          ativos.delete(ativo.turnId)
          deps.emit({ ...base(ativo), estado: 'falhou', erro: event.message })
          return
        default:
          // A tool, a permission question, a thought, the MCP roster, usage:
          // what the agent does underneath never reaches the conversation
          // (criterion 17).
          return
      }
    },

    abandon(turnId: string): void {
      ativos.delete(turnId)
    },

    interrupt(): void {
      for (const ativo of [...ativos.values()]) concluir(ativo, 'parado')
    }
  }
}
