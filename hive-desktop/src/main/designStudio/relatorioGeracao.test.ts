import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createHash } from 'crypto'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { AgentEvent } from '../agentAdapter'
import { readCatalogo } from './catalogo'
import { frenteValida, gravarRelatorio, relatorioTexto } from './__tests__/fixtures'
import { latestRelatorio } from './relatorios'
import {
  createGenerationService,
  generationPrompt,
  localDay,
  PROGRESS_POLL_MS,
  type EventoDeGeracao,
  type PedidoDeGeracao,
  type ServicoDeGeracao
} from './relatorioGeracao'

/**
 * Design Studio — one Relatório being generated, in the service that owns its
 * file (criteria 13–16, Landing 18). The agent is played by the test: it
 * writes the working copy the prompt names, then the turn ends one way or
 * another. What the module reads afterwards is the claim.
 */

const RESOURCES = join(__dirname, '..', '..', '..', 'resources', 'design-studio')
const HOJE = new Date(2026, 9, 4, 15, 30)
const DIA = localDay(HOJE)

let base: string
let root: string
let events: EventoDeGeracao[]
let ticks: Array<() => void>
let stopped: unknown[]
let service: ServicoDeGeracao
let turn = 0

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'hive-geracao-'))
  root = join(base, 'Documentos', 'Design Studio')
  events = []
  ticks = []
  stopped = []
  turn = 0
  service = createGenerationService({
    root,
    resources: RESOURCES,
    catalogo: () => readCatalogo(RESOURCES),
    emit: (evento) => events.push(evento),
    now: () => HOJE,
    newTurnId: () => `turno-${++turn}`,
    timer: {
      start: (tick, ms) => {
        expect(ms).toBe(PROGRESS_POLL_MS)
        ticks.push(tick)
        return `handle-${ticks.length}`
      },
      stop: (handle) => stopped.push(handle)
    }
  })
})

afterEach(() => {
  rmSync(base, { recursive: true, force: true })
})

const PEDIDO: PedidoDeGeracao = {
  produto: 'Extrato',
  fonte: 'likert',
  agente: { id: 'claude-cli', nome: 'Claude', modelo: 'sonnet' }
}

/** Plans, and answers the working copy's path out of the prompt — where the agent reads it. */
function planear(pedido: PedidoDeGeracao = PEDIDO): {
  turnId: string
  copia: string
  prompt: string
} {
  const plano = service.plan(pedido)
  if (!plano.ok) throw new Error('ocupado')
  const copia = /--saida "([^"]+)"/.exec(plano.prompt)?.[1]
  if (!copia) throw new Error('no working copy in the prompt')
  return { turnId: plano.turnId, copia, prompt: plano.prompt }
}

function end(turnId: string, type: 'done' | 'error' | 'interrupted'): void {
  const event: AgentEvent =
    type === 'error' ? { type, message: 'claude exited with code 1', turnId } : { type, turnId }
  service.onAgentEvent(event)
}

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function likertDir(): string {
  return join(root, 'Extrato', 'relatorios', 'likert')
}

describe('a generation, from plan to file', () => {
  it('C13b: a turn that ends done with a valid file makes it the most recent Relatório of its Fonte', () => {
    expect(latestRelatorio(root, 'Extrato', 'likert')).toBeNull()
    const { turnId, copia } = planear()
    writeFileSync(copia, relatorioTexto(frenteValida()), 'utf-8')
    end(turnId, 'done')

    const latest = latestRelatorio(root, 'Extrato', 'likert')
    expect(latest?.caminho).toBe(`Extrato/relatorios/likert/${DIA}-90d.md`)
    expect(existsSync(join(likertDir(), `${DIA}-90d.md`))).toBe(true)
    expect(events[events.length - 1]).toEqual({
      turnId,
      produto: 'Extrato',
      fonte: 'likert',
      estado: 'pronto',
      relatorio: `Extrato/relatorios/likert/${DIA}-90d.md`,
      dores: 6
    })
  })

  it('C14a: "Gerar de novo" on a day that already has one makes …-90d-2.md, leaves the first byte for byte, and the newest geradoEm wins', () => {
    const primeiro = gravarRelatorio(
      root,
      'Extrato',
      'likert',
      `${DIA}-90d.md`,
      relatorioTexto(frenteValida({ geradoEm: '2026-10-04T09:00:00.000Z' }))
    )
    const antes = sha256(primeiro)

    const { turnId, copia } = planear()
    expect(copia).toBe(join(likertDir(), `.${DIA}-90d-2.md.parcial`))
    writeFileSync(
      copia,
      relatorioTexto(frenteValida({ geradoEm: '2026-10-04T15:00:00.000Z', destaque: 'O novo' })),
      'utf-8'
    )
    end(turnId, 'done')

    expect(existsSync(join(likertDir(), `${DIA}-90d-2.md`))).toBe(true)
    expect(sha256(primeiro)).toBe(antes)
    const latest = latestRelatorio(root, 'Extrato', 'likert')
    expect(latest?.caminho).toBe(`Extrato/relatorios/likert/${DIA}-90d-2.md`)
    expect(latest?.destaque).toBe('O novo')
  })

  it('C14a: the most recent is the greatest geradoEm, not the greatest name', () => {
    gravarRelatorio(
      root,
      'Extrato',
      'likert',
      `${DIA}-90d.md`,
      relatorioTexto(frenteValida({ geradoEm: '2026-10-04T18:00:00.000Z', destaque: 'tarde' }))
    )
    gravarRelatorio(
      root,
      'Extrato',
      'likert',
      `${DIA}-90d-2.md`,
      relatorioTexto(frenteValida({ geradoEm: '2026-10-04T08:00:00.000Z', destaque: 'manhã' }))
    )
    expect(latestRelatorio(root, 'Extrato', 'likert')?.destaque).toBe('tarde')
  })

  /** What each failure leaves on disk before the turn ends: a file the agent wrote. */
  const FALHAS: Array<[string, 'done' | 'error' | 'interrupted', string | null]> = [
    // The agent wrote a whole, valid file — and then the turn failed.
    ['error', 'error', relatorioTexto(frenteValida({ destaque: 'do turno que falhou' }))],
    [
      'interrupted',
      'interrupted',
      relatorioTexto(frenteValida({ destaque: 'do turno interrompido' }))
    ],
    // The turn ended well, but the file is not in the format.
    [
      'out of format',
      'done',
      relatorioTexto(frenteValida({ formato: 'outro/1', destaque: 'fora do formato' }))
    ]
  ]

  it.each(
    FALHAS.flatMap(([nome, fim, texto]) => [
      [nome, 'no previous Relatório', fim, texto, false] as const,
      [nome, 'a previous Relatório', fim, texto, true] as const
    ])
  )(
    'C15a: %s with %s — the Relatório read afterwards is the one from before',
    (_nome, _antes, fim, texto, comAnterior) => {
      if (comAnterior) {
        gravarRelatorio(
          root,
          'Extrato',
          'likert',
          '2026-10-01-90d.md',
          relatorioTexto(
            frenteValida({ geradoEm: '2026-10-01T10:00:00.000Z', destaque: 'o anterior' })
          )
        )
      }
      const antes = latestRelatorio(root, 'Extrato', 'likert')
      const { turnId, copia } = planear()
      if (texto !== null) writeFileSync(copia, texto, 'utf-8')
      end(turnId, fim)

      expect(latestRelatorio(root, 'Extrato', 'likert')).toEqual(antes)
      // The invalid file is never read: it stays a hidden working copy.
      const publicados = readdirSync(likertDir()).filter(
        (n) => n.endsWith('.md') && !n.startsWith('.')
      )
      expect(publicados).toEqual(comAnterior ? ['2026-10-01-90d.md'] : [])
      expect(existsSync(copia)).toBe(true)
      const motivo = fim === 'error' ? 'erro' : fim === 'interrupted' ? 'interrompido' : 'formato'
      expect(events[events.length - 1]).toMatchObject({ turnId, estado: 'falhou', motivo })
    }
  )

  it('a turn that ends done without writing anything fails as out of format', () => {
    const { turnId } = planear()
    end(turnId, 'done')
    expect(events[events.length - 1]).toMatchObject({ estado: 'falhou', motivo: 'formato' })
    expect(latestRelatorio(root, 'Extrato', 'likert')).toBeNull()
  })

  it('refuses a valid file that names another Produto or Fonte than the one asked for', () => {
    const { turnId, copia } = planear()
    writeFileSync(copia, relatorioTexto(frenteValida({}, { produto: 'Pix' })), 'utf-8')
    end(turnId, 'done')
    expect(events[events.length - 1]).toMatchObject({ estado: 'falhou', motivo: 'formato' })
  })
})

describe('the plan', () => {
  it('scopes the turn to the Produto: cwd, reading, writing and the one command', () => {
    const plano = service.plan(PEDIDO)
    if (!plano.ok) throw new Error('ocupado')
    const script = join(RESOURCES, 'skills', 'relatorio-likert', 'scripts', 'relatorio.mjs')
    expect(plano.scope).toEqual({
      cwd: join(root, 'Extrato'),
      readRoots: [root, RESOURCES],
      writeRoots: [join(root, 'Extrato', 'relatorios')],
      commands: [`node "${script}"`]
    })
    // The prompt names the skill and spells the exact command, on stdin.
    expect(plano.prompt).toContain('"relatorio-likert"')
    expect(plano.prompt).toContain(
      `node "${script}" --dados "${join(RESOURCES, 'dados-de-exemplo', 'extrato', 'likert.json')}"`
    )
    expect(plano.prompt).toContain('--agente "Claude" --modelo "sonnet"')
    expect(plano.prompt.split('\n').length).toBeGreaterThan(3)
    // The folder the turn runs in exists before the turn does.
    expect(existsSync(likertDir())).toBe(true)
  })

  it('C16: plans one generation at a time, for any Produto or Fonte', () => {
    planear()
    expect(service.plan({ ...PEDIDO, produto: 'Pix', fonte: 'voz' })).toEqual({
      ok: false,
      motivo: 'ocupado'
    })
    expect(service.plan(PEDIDO)).toEqual({ ok: false, motivo: 'ocupado' })
  })

  it('throws for a Produto or Fonte the catalog does not have', () => {
    expect(() => service.plan({ ...PEDIDO, produto: 'Cartões' })).toThrow()
    expect(() => service.plan({ ...PEDIDO, fonte: 'nps' as never })).toThrow()
  })

  it('writes no model when the agent has none pinned', () => {
    const plano = service.plan({ ...PEDIDO, agente: { id: 'devin', nome: 'Devin', modelo: null } })
    expect(plano.ok && plano.prompt).toContain('--agente "Devin" --modelo ""')
  })

  it('composes a prompt line by line', () => {
    expect(
      generationPrompt({
        produto: 'Pix',
        fonteNome: 'FullStory',
        fonte: 'fullstory',
        skillDir: '/s',
        command: 'node "/s/r.mjs"',
        copia: '/p/.c'
      })
    ).toMatch(
      /^Gere o Relatório de Fonte de FullStory do Produto Pix com a skill "relatorio-fullstory"\./
    )
  })
})

describe('progress and the generation’s end', () => {
  it('announces each step the skill writes, forward only, up to 4', () => {
    const { turnId, copia } = planear()
    expect(events).toEqual([
      { turnId, produto: 'Extrato', fonte: 'likert', estado: 'gerando', passo: 1 }
    ])
    expect(service.current()).toEqual(events[0])

    ticks[0]() // no progress file yet
    writeFileSync(`${copia}.progresso`, JSON.stringify({ passo: 2 }))
    ticks[0]()
    writeFileSync(`${copia}.progresso`, 'não é JSON')
    ticks[0]()
    writeFileSync(`${copia}.progresso`, JSON.stringify({ passo: 1 }))
    ticks[0]()
    writeFileSync(`${copia}.progresso`, JSON.stringify({ passo: 9 }))
    ticks[0]()
    writeFileSync(`${copia}.progresso`, JSON.stringify({ passo: 4 }))
    ticks[0]()

    expect(events.map((e) => (e.estado === 'gerando' ? e.passo : e.estado))).toEqual([1, 2, 4])
    expect(service.current()).toMatchObject({ estado: 'gerando', passo: 4 })

    end(turnId, 'interrupted')
    expect(stopped).toEqual(['handle-1'])
    expect(existsSync(`${copia}.progresso`)).toBe(false)
    expect(service.current()).toBeNull()
    ticks[0]() // a late tick after the end is a no-op
  })

  it('ignores every other turn’s events, and every non-terminal one', () => {
    const { turnId } = planear()
    service.onAgentEvent({ type: 'done', turnId: 'outro-turno' })
    service.onAgentEvent({ type: 'token', text: 'oi', turnId })
    expect(service.current()).not.toBeNull()
  })

  it('abandon() forgets the generation without publishing or announcing anything', () => {
    const { turnId } = planear()
    service.abandon('outro')
    expect(service.current()).not.toBeNull()
    service.abandon(turnId)
    expect(service.current()).toBeNull()
    expect(events).toHaveLength(1)
    expect(service.plan(PEDIDO).ok).toBe(true)
  })

  it('interrupt() ends the generation in flight as interrupted (agent:stop)', () => {
    service.interrupt() // nothing in flight: nothing to say
    expect(events).toEqual([])
    const { turnId } = planear()
    service.interrupt()
    expect(events[events.length - 1]).toMatchObject({
      turnId,
      estado: 'falhou',
      motivo: 'interrompido'
    })
  })

  it('names the next file of the day past a name another Relatório took meanwhile', () => {
    const { turnId, copia } = planear()
    writeFileSync(copia, relatorioTexto(frenteValida()), 'utf-8')
    mkdirSync(likertDir(), { recursive: true })
    gravarRelatorio(root, 'Extrato', 'likert', `${DIA}-90d.md`, relatorioTexto(frenteValida()))
    end(turnId, 'done')
    expect(existsSync(join(likertDir(), `${DIA}-90d-2.md`))).toBe(true)
  })
})

describe('the service on its own defaults', () => {
  it('polls with a real interval, names turns itself, and stops polling when the turn ends', async () => {
    const heard: EventoDeGeracao[] = []
    const own = createGenerationService({
      root,
      resources: RESOURCES,
      catalogo: () => readCatalogo(RESOURCES),
      emit: (evento) => heard.push(evento)
    })
    const plano = own.plan(PEDIDO)
    if (!plano.ok) throw new Error('ocupado')
    expect(plano.turnId).toMatch(/^ds-relatorio-/)
    const copia = /--saida "([^"]+)"/.exec(plano.prompt)?.[1] as string
    writeFileSync(`${copia}.progresso`, JSON.stringify({ passo: 3 }))
    await new Promise((resolve) => setTimeout(resolve, PROGRESS_POLL_MS + 150))
    expect(heard.map((e) => (e.estado === 'gerando' ? e.passo : e.estado))).toEqual([1, 3])
    own.onAgentEvent({ type: 'error', message: 'x', turnId: plano.turnId })
    expect(heard[heard.length - 1]).toMatchObject({ estado: 'falhou', motivo: 'erro' })
  })
})
