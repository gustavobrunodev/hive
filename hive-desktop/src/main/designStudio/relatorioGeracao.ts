import { randomUUID } from 'crypto'
import { mkdirSync, readFileSync, renameSync, rmSync } from 'fs'
import { join } from 'path'
import type { AgentEvent, TurnScope } from '../agentAdapter'
import { isFonte, type Catalogo, type FonteId } from './catalogo'
import { readRelatorio } from './relatorioFormato'
import { nextRelatorioName, relatoriosDir } from './relatorios'

/**
 * Design Studio — one Relatório being generated, from the plan to the file
 * (criteria 12–16, Landing 18 and 19).
 *
 * The renderer starts the turn (`agent.send`, with the plan's prompt and
 * scope); this service plans it, watches the skill's progress file, and on the
 * turn's terminal event decides what happens to the working copy. Only a valid
 * copy of a turn that ended `done` is published — renamed to its final name —
 * so a failed or half-written generation is never read by any screen, and no
 * Relatório is ever deleted.
 */

/** What the person asked for, and the agent that will run it (Unresolved 14). */
export interface PedidoDeGeracao {
  produto: string
  fonte: FonteId
  agente: { id: string; nome: string; modelo: string | null }
}

export type PlanoDeGeracao =
  { ok: true; turnId: string; prompt: string; scope: TurnScope } | { ok: false; motivo: 'ocupado' }

/** Why a generation failed, in the three ways criterion 15 lists. */
export type MotivoDeFalha = 'erro' | 'interrompido' | 'formato'

/** One step of the generation's life, pushed to every window (`designStudio:geracao`). */
export type EventoDeGeracao = { turnId: string; produto: string; fonte: FonteId } & (
  | { estado: 'gerando'; passo: number }
  | { estado: 'pronto'; relatorio: string; dores: number }
  | { estado: 'falhou'; motivo: MotivoDeFalha }
)

export interface GeracaoDeps {
  /** `<raiz>`. */
  root: string
  /** The module's resources: skills and sample data (Landing 6). */
  resources: string
  catalogo: () => Catalogo
  emit: (evento: EventoDeGeracao) => void
  now?: () => Date
  newTurnId?: () => string
  /** How the progress file is polled. Injected so a test drives the clock. */
  timer?: {
    start: (tick: () => void, ms: number) => unknown
    stop: (handle: unknown) => void
  }
}

export interface ServicoDeGeracao {
  /** Plans a generation — one at a time (criterion 16). */
  plan(pedido: PedidoDeGeracao): PlanoDeGeracao
  /** Every agent event; only the planned turn's terminal event matters. */
  onAgentEvent(event: AgentEvent): void
  /** Reads the skill's progress file and announces a step forward. */
  checkProgress(): void
  /** The send never reached an agent: forget the generation, publish nothing. */
  abandon(turnId: string): void
  /** Every session was stopped (`agent:stop`): the turn ends as interrupted (Unresolved 5). */
  interrupt(): void
  /** The generation in progress, as its latest event, or `null`. */
  current(): EventoDeGeracao | null
}

/** How often the progress file is read. */
export const PROGRESS_POLL_MS = 500

/** The four steps of criterion 12. */
const ULTIMO_PASSO = 4

interface Ativa {
  turnId: string
  produto: string
  fonte: FonteId
  dir: string
  copia: string
  passo: number
  handle: unknown
}

/** `AAAA-MM-DD` of the local calendar day — the day the person sees. */
export function localDay(date: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`
}

/**
 * The turn's text, sent on stdin (never argv: it spans lines). It names the
 * skill, the exact command and the one file the agent edits afterwards.
 */
export function generationPrompt(input: {
  produto: string
  fonteNome: string
  fonte: FonteId
  skillDir: string
  command: string
  copia: string
}): string {
  return [
    `Gere o Relatório de Fonte de ${input.fonteNome} do Produto ${input.produto} com a skill "relatorio-${input.fonte}".`,
    '',
    `1. Leia a skill: ${join(input.skillDir, 'SKILL.md')}`,
    '2. Rode exatamente este comando, sem cd e sem nenhum outro comando antes ou depois:',
    `   ${input.command}`,
    `3. Abra ${input.copia} e reescreva só o corpo, abaixo do segundo ---, como a skill pede. Não mude o front matter.`,
    '',
    'Não leia nem grave nada fora desses caminhos. No fim, responda só "Relatório gravado."'
  ].join('\n')
}

const defaultTimer = {
  start: (tick: () => void, ms: number): unknown => setInterval(tick, ms),
  stop: (handle: unknown): void => clearInterval(handle as ReturnType<typeof setInterval>)
}

export function createGenerationService(deps: GeracaoDeps): ServicoDeGeracao {
  const now = deps.now ?? (() => new Date())
  const newTurnId = deps.newTurnId ?? (() => `ds-relatorio-${randomUUID()}`)
  const timer = deps.timer ?? defaultTimer
  let ativa: Ativa | null = null

  const progressFile = (copia: string): string => `${copia}.progresso`

  function evento(base: Ativa): { turnId: string; produto: string; fonte: FonteId } {
    return { turnId: base.turnId, produto: base.produto, fonte: base.fonte }
  }

  /** Ends the generation: stops the polling and drops the transient progress file. */
  function finish(): Ativa | null {
    const ended = ativa
    if (!ended) return null
    ativa = null
    timer.stop(ended.handle)
    rmSync(progressFile(ended.copia), { force: true })
    return ended
  }

  /**
   * The working copy, published: validated against decision 4 — and against
   * its own folder — then renamed to its final name. The name is chosen again
   * here, because another Relatório of the day may have landed meanwhile.
   */
  function publish(ended: Ativa): void {
    let text: string | null = null
    try {
      text = readFileSync(ended.copia, 'utf-8')
    } catch {
      text = null
    }
    const caminhoProvisorio = [ended.produto, 'relatorios', ended.fonte, 'x.md'].join('/')
    const leitura = text === null ? null : readRelatorio(text, caminhoProvisorio)
    const valido =
      leitura?.ok === true &&
      leitura.relatorio.produto === ended.produto &&
      leitura.relatorio.fonte === ended.fonte
    if (!valido || !leitura?.ok) {
      deps.emit({ ...evento(ended), estado: 'falhou', motivo: 'formato' })
      return
    }
    const nome = nextRelatorioName(ended.dir, localDay(now()))
    renameSync(ended.copia, join(ended.dir, nome))
    deps.emit({
      ...evento(ended),
      estado: 'pronto',
      relatorio: [ended.produto, 'relatorios', ended.fonte, nome].join('/'),
      dores: leitura.relatorio.dores.length
    })
  }

  /** Reads the skill's progress file and announces a step forward — never back, never past 4. */
  function checkProgress(): void {
    if (!ativa) return
    let passo: number
    try {
      passo = Number(
        (JSON.parse(readFileSync(progressFile(ativa.copia), 'utf-8')) as { passo?: unknown }).passo
      )
    } catch {
      return
    }
    if (!Number.isInteger(passo) || passo <= ativa.passo || passo > ULTIMO_PASSO) return
    ativa.passo = passo
    deps.emit({ ...evento(ativa), estado: 'gerando', passo })
  }

  return {
    plan(pedido: PedidoDeGeracao): PlanoDeGeracao {
      if (ativa) return { ok: false, motivo: 'ocupado' }
      const catalogo = deps.catalogo()
      const produto = catalogo.produtos.find((entry) => entry.nome === pedido.produto)
      const fonte = catalogo.fontes.find((entry) => entry.id === pedido.fonte)
      if (!produto || !fonte || !isFonte(pedido.fonte)) {
        throw new Error(`Produto ou Fonte desconhecidos: ${pedido.produto} · ${pedido.fonte}`)
      }
      const dir = relatoriosDir(deps.root, produto.nome, fonte.id)
      mkdirSync(dir, { recursive: true })
      const final = nextRelatorioName(dir, localDay(now()))
      const copia = join(dir, `.${final}.parcial`)
      rmSync(progressFile(copia), { force: true })

      const skillDir = join(deps.resources, 'skills', `relatorio-${fonte.id}`)
      const script = join(skillDir, 'scripts', 'relatorio.mjs')
      const dados = join(deps.resources, 'dados-de-exemplo', produto.id, `${fonte.id}.json`)
      const modelo = pedido.agente.modelo ?? ''
      const command = `node "${script}" --dados "${dados}" --saida "${copia}" --agente "${pedido.agente.nome}" --modelo "${modelo}"`
      const turnId = newTurnId()
      const scope: TurnScope = {
        cwd: join(deps.root, produto.nome),
        readRoots: [deps.root, deps.resources],
        writeRoots: [join(deps.root, produto.nome, 'relatorios')],
        commands: [`node "${script}"`]
      }
      ativa = {
        turnId,
        produto: produto.nome,
        fonte: fonte.id,
        dir,
        copia,
        passo: 1,
        handle: null
      }
      ativa.handle = timer.start(checkProgress, PROGRESS_POLL_MS)
      deps.emit({ ...evento(ativa), estado: 'gerando', passo: 1 })
      const prompt = generationPrompt({
        produto: produto.nome,
        fonteNome: fonte.nome,
        fonte: fonte.id,
        skillDir,
        command,
        copia
      })
      return { ok: true, turnId, prompt, scope }
    },

    onAgentEvent(event: AgentEvent): void {
      if (!ativa || event.turnId !== ativa.turnId) return
      if (event.type !== 'done' && event.type !== 'error' && event.type !== 'interrupted') return
      const ended = finish() as Ativa
      if (event.type === 'done') {
        publish(ended)
        return
      }
      deps.emit({
        ...evento(ended),
        estado: 'falhou',
        motivo: event.type === 'error' ? 'erro' : 'interrompido'
      })
    },

    checkProgress,

    abandon(turnId: string): void {
      if (ativa?.turnId === turnId) finish()
    },

    interrupt(): void {
      const ended = finish()
      if (ended) deps.emit({ ...evento(ended), estado: 'falhou', motivo: 'interrompido' })
    },

    current(): EventoDeGeracao | null {
      return ativa ? { ...evento(ativa), estado: 'gerando', passo: ativa.passo } : null
    }
  }
}
