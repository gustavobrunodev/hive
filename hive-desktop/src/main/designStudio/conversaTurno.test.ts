import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { ApprovalEvent } from '../agentAdapter'
import { createApprovalService } from '../approvalService'
import { createChatHistoryStore, type ChatHistoryStore } from '../chatHistoryStore'
import { readCatalogo } from './catalogo'
import { frenteValida, gravarRelatorio, relatorioTexto } from './__tests__/fixtures'
import {
  anexosDir,
  conversaScope,
  createConversaService,
  guardarColado,
  type EventoDeConversa,
  type PedidoDeConversa,
  type ServicoDeConversa
} from './conversaTurno'
import { decideScoped } from './turnScope'

/**
 * Design Studio — a turn of the conversa do Produto, in the service that plans
 * it and records it (criteria 8, 11, 16–18). The Relatórios are real files on
 * disk and the history is the real store; the agent is played by the test,
 * through the events its adapter would emit.
 */

const RESOURCES = join(__dirname, '..', '..', '..', 'resources', 'design-studio')

let base: string
let root: string
let store: ChatHistoryStore
let events: EventoDeConversa[]
let service: ServicoDeConversa
let turno = 0

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'hive-conversa-'))
  root = join(base, 'Documentos', 'Design Studio')
  store = createChatHistoryStore(join(base, 'userData'))
  events = []
  turno = 0
  service = createConversaService({
    root,
    store,
    catalogo: () => readCatalogo(RESOURCES),
    emit: (evento) => events.push(evento),
    newTurnId: () => `turno-${++turno}`
  })
})

afterEach(() => {
  rmSync(base, { recursive: true, force: true })
})

function pedido(overrides: Partial<PedidoDeConversa> = {}): PedidoDeConversa {
  return {
    produto: 'Câmbio',
    conversa: null,
    texto: 'Quais Dores crescem mais?',
    titulo: 'Quais Dores crescem mais?',
    citadas: [],
    relatoriosAnexados: [],
    anexos: [],
    agente: { id: 'claude-cli', modelo: 'sonnet' },
    ...overrides
  }
}

/** A Relatório file of `produto` × `fonte`, generated at `geradoEm`, with a narrative and Dores of its own. */
function relatorioEm(
  produto: string,
  fonte: string,
  arquivo: string,
  geradoEm: string,
  marca: string
): string {
  const frente = frenteValida({ geradoEm }, { produto, fonte, dores: 3 })
  const dores = (frente.dores as Array<Record<string, unknown>>).map((dor, i) => ({
    ...dor,
    id: `${marca}-dor-${i + 1}`,
    titulo: `Dor ${i + 1} ${marca}`
  }))
  gravarRelatorio(
    root,
    produto,
    fonte,
    arquivo,
    relatorioTexto({ ...frente, dores }, [`Narrativa ${marca}.`])
  )
  return [produto, 'relatorios', fonte, arquivo].join('/')
}

function planOk(
  input: Partial<PedidoDeConversa> = {}
): Extract<ReturnType<ServicoDeConversa['plan']>, { ok: true }> {
  const plano = service.plan(pedido(input))
  if (!plano.ok) throw new Error(`plan refused: ${plano.motivo}`)
  return plano
}

describe('the conversa do Produto turn', () => {
  it('1-C11: the turn carries the narrative and the ranked Dores of the most recent Relatório of each Fonte of that Produto only', () => {
    relatorioEm('Câmbio', 'likert', '2026-09-01-90d.md', '2026-09-01T10:00:00.000Z', 'likert-velho')
    relatorioEm('Câmbio', 'likert', '2026-10-04-90d.md', '2026-10-04T10:00:00.000Z', 'likert-novo')
    relatorioEm('Câmbio', 'voz', '2026-10-03-90d.md', '2026-10-03T10:00:00.000Z', 'voz-novo')
    relatorioEm('Extrato', 'likert', '2026-10-05-90d.md', '2026-10-05T10:00:00.000Z', 'extrato')

    const { prompt } = planOk()

    // The newest Likert and the Voz: their narrative and every ranked Dor, with its id.
    expect(prompt).toContain('Narrativa likert-novo.')
    expect(prompt).toContain('Narrativa voz-novo.')
    for (const marca of ['likert-novo', 'voz-novo']) {
      for (const n of [1, 2, 3]) {
        expect(prompt).toContain(`${n}. [${marca}-dor-${n}] Dor ${n} ${marca}`)
      }
    }
    // The older Likert of the same Produto, and another Produto's Relatório, do not.
    expect(prompt).not.toContain('likert-velho')
    expect(prompt).not.toContain('extrato')
    // And the person's own message closes it.
    expect(prompt.trimEnd().endsWith('Quais Dores crescem mais?')).toBe(true)
  })

  it('1-C8c: an attached Relatório enters the turn as context — the turn holds that file’s content', () => {
    const caminho = relatorioEm(
      'Câmbio',
      'voz',
      '2026-10-03-90d.md',
      '2026-10-03T10:00:00.000Z',
      'anexado'
    )
    const conteudo = readFileSync(join(root, caminho), 'utf-8')

    const { prompt } = planOk({ relatoriosAnexados: [caminho] })

    expect(prompt).toContain('Relatório de Voz do Cliente · Câmbio')
    expect(prompt).toContain(conteudo)
  })

  it('1-C18a: the turn goes out with its scope — the Produto folder, reading only relatorios/, no writing and no command', () => {
    const { scope } = planOk()
    expect(scope).toEqual({
      cwd: join(root, 'Câmbio'),
      readRoots: [join(root, 'Câmbio', 'relatorios')],
      writeRoots: [],
      commands: []
    })
  })

  it('1-C18b: with that scope, decideScoped denies a write, a command and a read outside relatorios/', () => {
    const scope = conversaScope(root, 'Câmbio')
    const produto = join(root, 'Câmbio')
    expect(decideScoped(scope, { kind: 'write', path: join(produto, 'notas.md') })).toBe('deny')
    expect(
      decideScoped(scope, { kind: 'write', path: join(produto, 'relatorios', 'likert', 'x.md') })
    ).toBe('deny')
    expect(decideScoped(scope, { kind: 'command', command: 'ls -la' })).toBe('deny')
    expect(decideScoped(scope, { kind: 'read', path: join(produto, 'notas.md') })).toBe('deny')
    expect(decideScoped(scope, { kind: 'read', path: join(root, 'Pix', 'relatorios') })).toBe(
      'deny'
    )
    expect(decideScoped(scope, { kind: 'read', path: '/etc/passwd' })).toBe('deny')
    // …while reading the Produto's Relatórios is what the turn is for.
    expect(
      decideScoped(scope, { kind: 'read', path: join(produto, 'relatorios', 'voz', 'a.md') })
    ).toBe('allow')
  })

  it('1-C18b: and the request never becomes an approval card — the endpoint answers deny with no event raised', async () => {
    const configDir = mkdtempSync(join(tmpdir(), 'hive-approvals-conversa-'))
    const approvals = createApprovalService({ configDir })
    await approvals.listen()
    const raised: ApprovalEvent[] = []
    approvals.onRequest((request) => raised.push(request))
    try {
      const { scope, turnId } = planOk()
      const path = approvals.mcpConfig(turnId, scope) as string
      const config = JSON.parse(readFileSync(path, 'utf-8')) as {
        mcpServers: Record<string, { url: string; headers: Record<string, string> }>
      }
      const server = config.mcpServers.hive_approvals
      const ask = async (tool: string, input: Record<string, unknown>): Promise<string> => {
        const headers = new Headers(server.headers)
        headers.set('content-type', 'application/json')
        const response = await fetch(server.url, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: { name: 'approve', arguments: { tool_name: tool, input } }
          })
        })
        const body = (await response.json()) as { result: { content: Array<{ text: string }> } }
        return (JSON.parse(body.result.content[0].text) as { behavior: string }).behavior
      }
      expect(await ask('Write', { file_path: join(root, 'Câmbio', 'notas.md') })).toBe('deny')
      expect(await ask('Bash', { command: 'rm -rf ~' })).toBe('deny')
      expect(await ask('Read', { file_path: join(root, 'Câmbio', 'notas.md') })).toBe('deny')
      expect(raised).toEqual([])
    } finally {
      await approvals.close()
      rmSync(configDir, { recursive: true, force: true })
    }
  })

  it('starts the conversation in the Produto’s history, titled as the renderer cut it, with the person’s message', () => {
    const plano = planOk({ texto: 'Quais Dores crescem mais?', titulo: 'Quais Dores' })
    const sessao = store.get(join(root, 'Câmbio'), plano.conversa)
    expect(sessao?.title).toBe('Quais Dores')
    expect(sessao?.messages.map((m) => [m.role, m.text])).toEqual([
      ['user', 'Quais Dores crescem mais?']
    ])
    // A follow-up keeps the title it was given.
    service.onAgentEvent({ type: 'done', turnId: plano.turnId })
    planOk({ conversa: plano.conversa, texto: 'E a segunda?', titulo: 'outro' })
    expect(store.get(join(root, 'Câmbio'), plano.conversa)?.title).toBe('Quais Dores')
  })

  it('streams only the reply’s text, then records it with the agent and the model that gave it (criteria 16, 17)', () => {
    const plano = planOk({ agente: { id: 'devin', modelo: 'swe-1-5' } })
    const at = { turnId: plano.turnId }
    service.onAgentEvent({ type: 'token', text: 'As Dores ', ...at })
    service.onAgentEvent({
      type: 'tool',
      phase: 'start',
      toolId: 't1',
      name: 'Read',
      detail: '/x',
      ...at
    } as never)
    service.onAgentEvent({ type: 'thought', text: 'pensando', ...at })
    service.onAgentEvent({ type: 'token', text: 'que crescem.', ...at })
    service.onAgentEvent({ type: 'session', id: 'cli-1', ...at })
    service.onAgentEvent({ type: 'done', ...at })

    expect(events.map((e) => e.estado)).toEqual(['escrevendo', 'escrevendo', 'pronto'])
    expect(events[1]).toMatchObject({ estado: 'escrevendo', texto: 'As Dores que crescem.' })
    expect(events[2]).toMatchObject({
      estado: 'pronto',
      texto: 'As Dores que crescem.',
      agente: 'devin',
      modelo: 'swe-1-5',
      conversa: plano.conversa,
      produto: 'Câmbio'
    })
    const lida = service.ler('Câmbio', plano.conversa)
    expect(lida?.mensagens.map((m) => [m.papel, m.texto, m.agente, m.modelo])).toEqual([
      ['pessoa', 'Quais Dores crescem mais?', null, null],
      ['agente', 'As Dores que crescem.', 'devin', 'swe-1-5']
    ])
  })

  it('ignores the events of turns that are not its own', () => {
    service.onAgentEvent({ type: 'token', text: 'do Chat', turnId: 'chat-1' })
    service.onAgentEvent({ type: 'done' })
    expect(events).toEqual([])
  })

  it('a failed turn records nothing and reports the agent’s message for the renderer to classify', () => {
    const plano = planOk()
    service.onAgentEvent({ type: 'token', text: 'meio', turnId: plano.turnId })
    service.onAgentEvent({ type: 'error', message: 'claude-auth:signed-out', turnId: plano.turnId })
    expect(events.at(-1)).toMatchObject({ estado: 'falhou', erro: 'claude-auth:signed-out' })
    expect(service.ler('Câmbio', plano.conversa)?.mensagens).toHaveLength(1)
  })

  it('a turn that ends with no words is a failure, not an empty reply', () => {
    const plano = planOk()
    service.onAgentEvent({ type: 'done', turnId: plano.turnId })
    expect(events.at(-1)).toMatchObject({ estado: 'falhou', erro: '' })
  })

  it('a stopped turn keeps what it had written; stopping every session ends the turns in flight', () => {
    const primeiro = planOk()
    service.onAgentEvent({ type: 'token', text: 'Parcial', turnId: primeiro.turnId })
    service.onAgentEvent({ type: 'interrupted', turnId: primeiro.turnId })
    expect(events.at(-1)).toMatchObject({ estado: 'parado', texto: 'Parcial' })
    expect(service.ler('Câmbio', primeiro.conversa)?.mensagens.at(-1)?.texto).toBe('Parcial')

    const segundo = planOk({ conversa: primeiro.conversa, texto: 'De novo' })
    service.interrupt()
    expect(events.at(-1)).toMatchObject({ estado: 'parado', turnId: segundo.turnId, texto: '' })
  })

  it('one turn at a time per conversation; an abandoned send frees it', () => {
    const plano = planOk()
    expect(service.plan(pedido({ conversa: plano.conversa }))).toEqual({
      ok: false,
      motivo: 'ocupado'
    })
    service.abandon(plano.turnId)
    expect(service.plan(pedido({ conversa: plano.conversa })).ok).toBe(true)
  })

  it('refuses a Produto the catalog does not know, and a conversation that is not there', () => {
    expect(service.plan(pedido({ produto: 'Seguros' }))).toEqual({
      ok: false,
      motivo: 'desconhecida'
    })
    expect(service.plan(pedido({ conversa: '00000000-0000-4000-8000-000000000000' }))).toEqual({
      ok: false,
      motivo: 'desconhecida'
    })
    expect(service.iniciar('Seguros', 'x', 'x')).toBeNull()
    expect(service.ler('Seguros', 'x')).toBeNull()
    expect(service.ler('Câmbio', '00000000-0000-4000-8000-000000000000')).toBeNull()
  })

  it('resumes the agent’s own session, and starts a fresh one when the agent changes (Landing, resume per agent)', () => {
    const reabrir = (): ServicoDeConversa =>
      createConversaService({
        root,
        store,
        catalogo: () => readCatalogo(RESOURCES),
        emit: () => {}
      })
    const responder = (svc: ServicoDeConversa, turnId: string, sessao?: string): void => {
      svc.onAgentEvent({ type: 'token', text: 'resposta', turnId })
      if (sessao) svc.onAgentEvent({ type: 'session', id: sessao, turnId })
      svc.onAgentEvent({ type: 'done', turnId })
    }

    const primeiro = planOk()
    expect(primeiro).toMatchObject({ resume: null, freshSession: true })
    responder(service, primeiro.turnId, 'cli-claude')
    const conversa = primeiro.conversa

    // The same agent continues its own CLI session — even on a turn that
    // announced no session of its own.
    const segundo = planOk({ conversa })
    expect(segundo).toMatchObject({ resume: 'cli-claude', freshSession: false })
    responder(service, segundo.turnId)

    // After a restart, the stored session is the last reply's agent's.
    const depois = reabrir()
    const claude = depois.plan(pedido({ conversa }))
    expect(claude).toMatchObject({ ok: true, resume: 'cli-claude' })
    if (claude.ok) responder(depois, claude.turnId)

    // Another agent never receives that session: it starts its own.
    const devin = depois.plan(pedido({ conversa, agente: { id: 'devin', modelo: null } }))
    expect(devin).toMatchObject({ ok: true, resume: null, freshSession: true })
    if (devin.ok) responder(depois, devin.turnId)

    // Devin answered without a session id: nothing of Claude's is left for it.
    const devinDeNovo = reabrir().plan(pedido({ conversa, agente: { id: 'devin', modelo: null } }))
    expect(devinDeNovo).toMatchObject({ ok: true, resume: null, freshSession: true })
  })

  it('copies each attachment into the conversation’s folder inside relatorios/, where the turn may read it', () => {
    const fora = join(base, 'Downloads')
    mkdirSync(fora, { recursive: true })
    const print = join(fora, 'print.png')
    writeFileSync(print, 'png')
    const plano = planOk({
      anexos: [
        { path: print, name: 'print.png' },
        { path: print, name: 'print.png' },
        { path: join(fora, 'sumiu.pdf'), name: 'sumiu.pdf' }
      ]
    })
    const dir = anexosDir(root, 'Câmbio', plano.conversa)
    expect(plano.anexos).toEqual([join(dir, 'print.png'), join(dir, 'print (2).png')])
    expect(readFileSync(plano.anexos[0], 'utf-8')).toBe('png')
    for (const copia of plano.anexos) {
      expect(decideScoped(plano.scope, { kind: 'read', path: copia })).toBe('allow')
    }
    expect(store.get(join(root, 'Câmbio'), plano.conversa)?.messages[0].attachments).toEqual([
      'print.png',
      'print.png',
      'sumiu.pdf'
    ])
  })

  it('names the cited Dores in the turn; one the Relatório no longer has is left out', () => {
    const caminho = relatorioEm('Câmbio', 'voz', '2026-10-03-90d.md', '2026-10-03T10:00:00Z', 'v')
    const { prompt } = planOk({
      citadas: [
        { relatorio: caminho, dor: 'v-dor-2' },
        { relatorio: caminho, dor: 'nao-existe' }
      ]
    })
    expect(prompt).toContain('# Dores citadas pela pessoa\n- [v-dor-2] Dor 2 v')
    expect(prompt).not.toContain('nao-existe')
  })

  it('says so when the Produto has no Relatório yet', () => {
    expect(planOk().prompt).toContain('Câmbio ainda não tem Relatórios de Fonte.')
  })

  it('the guided flow starts a conversation with the person’s line and no turn (criterion 3)', () => {
    const id = service.iniciar(
      'Pix',
      'Quero gerar o primeiro Relatório de Pix',
      'Quero gerar o primeiro Relatório de Pix'
    ) as string
    const lida = service.ler('Pix', id)
    expect(lida?.titulo).toBe('Quero gerar o primeiro Relatório de Pix')
    expect(lida?.mensagens.map((m) => m.papel)).toEqual(['pessoa'])
  })
})

describe('guardarColado', () => {
  it('writes a pasted print to a folder of its own and answers what the tray draws', () => {
    const dir = mkdtempSync(join(tmpdir(), 'hive-colado-'))
    try {
      const salvo = guardarColado(dir, 'image.png', new Uint8Array([1, 2, 3]))
      expect(salvo.name).toBe('image.png')
      expect(salvo.size).toBe(3)
      expect(existsSync(salvo.path)).toBe(true)
      expect(guardarColado(dir, '../../fora.png', new Uint8Array([1])).name).toBe('fora.png')
      expect(guardarColado(dir, '', new Uint8Array([1])).name).toBe('print-colado.png')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
