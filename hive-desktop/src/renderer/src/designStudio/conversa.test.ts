// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { ClaudeAuthSession } from '../claudeAuth/useClaudeAuth'
import {
  activePage,
  camada,
  prepararDom,
  relatorio,
  renderModuloVivo,
  stubBridge,
  type EventoDeConversa
} from './__tests__/fixtures'
import { fontesSemRelatorio } from './conversaModel'

/**
 * P13 — the conversa do Produto (criteria 3 and 10–17 of task 1, `home.js` and
 * `chat.js`), in the module's real store: opened from the home, answered over
 * the module's own channel, stopped, switched to another agent, failed.
 *
 * Main is played by the bridge stub: `planejarConversa` plans like the
 * service, and each event below is one main would send on
 * `designStudio:conversa`.
 */

beforeAll(prepararDom)

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const CAMBIO = [
  relatorio('Câmbio', 'likert', [
    { titulo: 'A cotação muda entre simular e confirmar', impacto: 'alto' },
    { titulo: 'As taxas aparecem só no final', impacto: 'medio' }
  ]),
  relatorio('Câmbio', 'voz', [{ titulo: 'Minha transação estornou sem aviso', impacto: 'alto' }])
]

type Bridge = ReturnType<typeof stubBridge>

async function abrirInicio(
  relatorios = CAMBIO,
  opcoes: { claudeAuth?: ClaudeAuthSession } = {}
): Promise<Bridge> {
  const bridge = stubBridge({ relatorios })
  renderModuloVivo({ pagina: 'inicio' }, opcoes)
  await screen.findByRole('heading', { level: 2, name: 'Dores em alta' })
  return bridge
}

const inicio = (): HTMLElement => camada('inicio')

function campoDe(pagina: HTMLElement): HTMLTextAreaElement {
  return within(pagina).getByRole('textbox', {
    name: 'Mensagem para o agente'
  }) as HTMLTextAreaElement
}

/** Writes in a field and presses Enter, once the field knows who answers. */
async function enviarPor(pagina: HTMLElement, texto: string): Promise<void> {
  await waitFor(() =>
    expect(within(pagina).getByRole('button', { name: /^Agente da conversa:/ })).toBeTruthy()
  )
  fireEvent.change(campoDe(pagina), { target: { value: texto } })
  await waitFor(() =>
    expect(
      (within(pagina).getByRole('button', { name: 'Enviar' }) as HTMLButtonElement).disabled
    ).toBe(false)
  )
  fireEvent.keyDown(campoDe(pagina), { key: 'Enter' })
}

/** Sends from the home and lands on the conversation it opened. */
async function abrirConversa(
  bridge: Bridge,
  texto = 'Quais Dores crescem mais?'
): Promise<{ pagina: HTMLElement; turnId: string; conversa: string }> {
  await enviarPor(inicio(), texto)
  await waitFor(() => expect(activePage().dataset.page).toBe('conversa'))
  const plano = await (
    bridge.conversa.planejarConversa as ReturnType<typeof vi.fn>
  ).mock.results.at(-1)?.value
  return { pagina: activePage(), turnId: plano.turnId, conversa: plano.conversa }
}

type Resto<E> = E extends unknown ? Omit<E, 'turnId' | 'conversa' | 'produto'> : never

function evento(
  base: { turnId: string; conversa: string },
  resto: Resto<EventoDeConversa>
): EventoDeConversa {
  return {
    turnId: base.turnId,
    conversa: base.conversa,
    produto: 'Câmbio',
    ...resto
  } as EventoDeConversa
}

async function responder(
  bridge: Bridge,
  base: { turnId: string; conversa: string },
  texto: string
): Promise<void> {
  await act(async () => {
    bridge.emitirConversa(evento(base, { estado: 'escrevendo', texto }))
    bridge.emitirConversa(
      evento(base, { estado: 'pronto', texto, agente: 'claude-cli', modelo: 'sonnet' })
    )
  })
}

function mensagens(pagina: HTMLElement): HTMLElement {
  return within(pagina).getByRole('log', { name: 'Mensagens da conversa' })
}

describe('the guided first Relatório', () => {
  it('1-C3b: "Gerar o primeiro Relatório de <Produto>" opens a conversation asking "Por qual Fonte quer começar?", with one button per Fonte without a Relatório', async () => {
    const bridge = await abrirInicio()
    fireEvent.click(within(inicio()).getByRole('radio', { name: 'Pix' }))
    fireEvent.click(
      await within(inicio()).findByRole('button', { name: 'Gerar o primeiro Relatório de Pix' })
    )
    await waitFor(() => expect(activePage().dataset.page).toBe('conversa'))
    const pagina = activePage()
    expect(await within(pagina).findByText('Por qual Fonte quer começar?')).toBeTruthy()
    const fontes = within(pagina).getByRole('group', { name: 'Fontes para começar' })
    expect(
      within(fontes)
        .getAllByRole('button')
        .map((b) => b.querySelector('b')?.textContent)
    ).toEqual(['Likert', 'Voz do Cliente', 'FullStory'])
    expect(bridge.conversa.novaConversa).toHaveBeenCalledWith(
      'Pix',
      'Quero gerar o primeiro Relatório de Pix',
      'Quero gerar o primeiro Relatório de Pix'
    )
  })

  it('1-C3b: the buttons are the Fontes still without a Relatório, and only those', () => {
    const likert = [relatorio('Pix', 'likert', [{}])]
    expect(fontesSemRelatorio(likert, 'Pix')).toEqual(['voz', 'fullstory'])
    expect(fontesSemRelatorio(likert, 'Câmbio')).toEqual(['likert', 'voz', 'fullstory'])
  })

  it('1-C3c: choosing a Fonte generates the Relatório in the conversation — the four steps in the order they come, then the highlight and the Dores that weigh most', async () => {
    const bridge = await abrirInicio()
    fireEvent.click(within(inicio()).getByRole('radio', { name: 'Pix' }))
    fireEvent.click(
      await within(inicio()).findByRole('button', { name: 'Gerar o primeiro Relatório de Pix' })
    )
    await waitFor(() => expect(activePage().dataset.page).toBe('conversa'))
    const pagina = activePage()
    fireEvent.click(await within(pagina).findByRole('button', { name: /^Likert/ }))
    await waitFor(() =>
      expect(bridge.planejarGeracao).toHaveBeenCalledWith(
        expect.objectContaining({ produto: 'Pix', fonte: 'likert' })
      )
    )
    expect(within(mensagens(pagina)).getByText('Começar pelo Likert')).toBeTruthy()

    const atual = (): string | null =>
      mensagens(pagina).querySelector('[aria-current="step"]')?.textContent ?? null
    const vistos: Array<string | null> = []
    for (const passo of [1, 2, 3, 4]) {
      await act(async () => {
        bridge.emit({
          turnId: 'turno-1',
          produto: 'Pix',
          fonte: 'likert',
          estado: 'gerando',
          passo
        })
      })
      vistos.push(atual())
    }
    expect(vistos).toEqual([
      'Lendo 22.480 respostas',
      'Agrupando por tema',
      'Ranqueando as Dores',
      'Escrevendo a narrativa'
    ])

    const pronto = relatorio('Pix', 'likert', [
      { titulo: 'Chave copiada não cola' },
      { titulo: 'Agendamento some' },
      { titulo: 'Limite noturno confunde' },
      { titulo: 'Quarta que não aparece' }
    ])
    bridge.setRelatorios([pronto])
    await act(async () => {
      bridge.emit({
        turnId: 'turno-1',
        produto: 'Pix',
        fonte: 'likert',
        estado: 'pronto',
        relatorio: pronto.caminho,
        dores: 4
      })
    })
    expect(
      await within(mensagens(pagina)).findByText(
        'Pronto. Destaque de likert de Pix. Estas são as Dores que mais pesam:'
      )
    ).toBeTruthy()
    const dores = Array.from(mensagens(pagina).querySelectorAll('.ds-cartao-dor-titulo')).map(
      (el) => el.textContent
    )
    expect(dores).toEqual(['Chave copiada não cola', 'Agendamento some', 'Limite noturno confunde'])
  })
})

describe('the conversa do Produto', () => {
  it('1-C10a: sending "Quais Dores crescem mais?" on the home opens a conversation of the chosen Produto, which shows in Recentes', async () => {
    const bridge = await abrirInicio()
    const listar = window.hive.designStudio.conversations as ReturnType<typeof vi.fn>
    ;(bridge.conversa.planejarConversa as ReturnType<typeof vi.fn>).mockImplementationOnce(
      async () => {
        listar.mockResolvedValue([
          {
            id: 'conversa-nova',
            produto: 'Câmbio',
            title: 'Quais Dores crescem mais?',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            messageCount: 1,
            agent: 'claude-cli',
            preview: 'Quais Dores crescem mais?',
            initiativePath: null
          }
        ])
        return {
          ok: true,
          conversa: 'conversa-nova',
          turnId: 'turno-novo',
          prompt: 'p',
          scope: { cwd: '/c', readRoots: [], writeRoots: [], commands: [] },
          resume: null,
          freshSession: true,
          anexos: []
        }
      }
    )
    await enviarPor(inicio(), 'Quais Dores crescem mais?')
    await waitFor(() => expect(activePage().dataset.page).toBe('conversa'))
    expect(bridge.conversa.planejarConversa).toHaveBeenCalledWith(
      expect.objectContaining({
        produto: 'Câmbio',
        conversa: null,
        texto: 'Quais Dores crescem mais?'
      })
    )
    const recentes = screen.getByRole('region', { name: 'Recentes' })
    expect(await within(recentes).findByText('Quais Dores crescem mais?')).toBeTruthy()
  })

  it('1-C10b: the title is the text sent, cut at 46 characters — 60 become the first 46, 20 stay whole', async () => {
    const sessenta = 'Quais são as Dores que mais crescem no Câmbio neste semestre'
    expect(sessenta).toHaveLength(60)
    const bridge = await abrirInicio()
    const { pagina } = await abrirConversa(bridge, sessenta)
    expect(within(pagina).getByRole('heading', { level: 1 }).textContent).toBe(
      sessenta.slice(0, 46)
    )
    expect(bridge.conversa.planejarConversa).toHaveBeenCalledWith(
      expect.objectContaining({ titulo: sessenta.slice(0, 46) })
    )

    cleanup()
    const outra = await abrirInicio()
    const vinte = 'Compare as Fontes já'
    expect(vinte).toHaveLength(20)
    const segunda = await abrirConversa(outra, vinte)
    expect(within(segunda.pagina).getByRole('heading', { level: 1 }).textContent).toBe(vinte)
  })

  it('1-C10c: the conversation shows the chips "<Produto>", "<n> de 3 Relatórios" and "Sem Protótipo"', async () => {
    const bridge = await abrirInicio()
    const { pagina } = await abrirConversa(bridge)
    const chips = within(pagina).getByRole('group', { name: 'Contexto da conversa' })
    expect(Array.from(chips.querySelectorAll('.ds-chip')).map((c) => c.textContent)).toEqual([
      'Câmbio',
      '2 de 3 Relatórios',
      'Sem Protótipo'
    ])
  })

  it('1-C10d: the person’s message, then the agent’s reply growing while the turn streams', async () => {
    const bridge = await abrirInicio()
    const base = await abrirConversa(bridge)
    const log = mensagens(base.pagina)
    expect(within(log).getByText('Quais Dores crescem mais?')).toBeTruthy()

    await act(async () =>
      bridge.emitirConversa(evento(base, { estado: 'escrevendo', texto: 'As Dores' }))
    )
    const resposta = (): HTMLElement => log.querySelector('.ds-msg-agente') as HTMLElement
    expect(resposta().querySelector('.ds-msg-texto')?.textContent).toBe('As Dores')
    await act(async () =>
      bridge.emitirConversa(
        evento(base, { estado: 'escrevendo', texto: 'As Dores que mais crescem' })
      )
    )
    expect(resposta().querySelector('.ds-msg-texto')?.textContent).toBe('As Dores que mais crescem')
    const pessoa = log.querySelector('.ds-msg-pessoa') as HTMLElement
    expect(
      pessoa.compareDocumentPosition(resposta()) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('1-C12a: a [[dor:<id>]] of a Dor of the Produto becomes its chip, and a mark with an unknown id leaves the text', async () => {
    const bridge = await abrirInicio()
    const base = await abrirConversa(bridge)
    await responder(
      bridge,
      base,
      'A que mais pesa é a cotação [[dor:likert-1]]. Outra [[dor:nao-existe]] some.'
    )
    const log = mensagens(base.pagina)
    expect(
      within(log).getByRole('button', {
        name: 'Abrir a Dor “A cotação muda entre simular e confirmar”'
      })
    ).toBeTruthy()
    expect(log.textContent).not.toContain('[[dor:')
    expect(log.textContent).not.toContain('nao-existe')
    expect(log.textContent).toContain('Outra  some.')
  })

  it('1-C12b: touching a Dor chip of a reply opens that Dor’s folha', async () => {
    const bridge = await abrirInicio()
    const base = await abrirConversa(bridge)
    await responder(bridge, base, 'Veja [[dor:voz-1]].')
    fireEvent.click(
      within(mensagens(base.pagina)).getByRole('button', {
        name: 'Abrir a Dor “Minha transação estornou sem aviso”'
      })
    )
    const folha = await screen.findByRole('dialog')
    expect(
      within(folha).getByRole('heading', { name: 'Minha transação estornou sem aviso' })
    ).toBeTruthy()
  })

  it('1-C13: each ready question sends its own text as the message', async () => {
    const bridge = await abrirInicio()
    const base = await abrirConversa(bridge)
    await responder(bridge, base, 'Primeira resposta.')
    const perguntas = [
      'Quais Dores crescem mais?',
      'Compare as três Fontes',
      'O que a Voz do Cliente diz?',
      'Por onde você começaria?'
    ]
    const grupo = within(base.pagina).getByRole('group', { name: 'Perguntas prontas' })
    expect(
      within(grupo)
        .getAllByRole('button')
        .map((b) => b.textContent)
    ).toEqual(perguntas)
    const planejar = bridge.conversa.planejarConversa as ReturnType<typeof vi.fn>
    for (const pergunta of perguntas) {
      const antes = planejar.mock.calls.length
      fireEvent.click(within(grupo).getByRole('button', { name: pergunta }))
      await waitFor(() => expect(planejar.mock.calls.length).toBe(antes + 1))
      expect(planejar.mock.calls.at(-1)?.[0]).toMatchObject({
        conversa: base.conversa,
        texto: pergunta
      })
      const plano = await planejar.mock.results.at(-1)?.value
      await responder(bridge, { turnId: plano.turnId, conversa: base.conversa }, 'ok')
    }
  })

  it('1-C14a: while the agent answers, the send button becomes "Parar"', async () => {
    const bridge = await abrirInicio()
    const base = await abrirConversa(bridge)
    await waitFor(() =>
      expect(within(base.pagina).getByRole('button', { name: 'Parar' })).toBeTruthy()
    )
    expect(within(base.pagina).queryByRole('button', { name: 'Enviar' })).toBeNull()
    await responder(bridge, base, 'Pronto.')
    await waitFor(() =>
      expect(within(base.pagina).getByRole('button', { name: 'Enviar' })).toBeTruthy()
    )
  })

  it('1-C14b: while the agent answers, Enter and the ready questions send nothing', async () => {
    const bridge = await abrirInicio()
    const base = await abrirConversa(bridge)
    await act(async () =>
      bridge.emitirConversa(evento(base, { estado: 'escrevendo', texto: 'Escrevendo' }))
    )
    const planejar = bridge.conversa.planejarConversa as ReturnType<typeof vi.fn>
    const antes = planejar.mock.calls.length
    fireEvent.change(campoDe(base.pagina), { target: { value: 'Outra pergunta' } })
    fireEvent.keyDown(campoDe(base.pagina), { key: 'Enter' })
    fireEvent.click(within(base.pagina).getByRole('button', { name: 'Compare as três Fontes' }))
    await act(async () => {})
    expect(planejar.mock.calls.length).toBe(antes)
  })

  it('1-C14c: "Parar" interrupts the turn in flight, and the field sends again', async () => {
    const bridge = await abrirInicio()
    const base = await abrirConversa(bridge)
    fireEvent.click(await within(base.pagina).findByRole('button', { name: 'Parar' }))
    await waitFor(() => expect(bridge.campo.agent.interrupt).toHaveBeenCalledWith(base.turnId))
    await act(async () =>
      bridge.emitirConversa(
        evento(base, { estado: 'parado', texto: 'Parcial', agente: 'claude-cli', modelo: 'sonnet' })
      )
    )
    const planejar = bridge.conversa.planejarConversa as ReturnType<typeof vi.fn>
    const antes = planejar.mock.calls.length
    await enviarPor(base.pagina, 'De novo')
    await waitFor(() => expect(planejar.mock.calls.length).toBe(antes + 1))
  })

  it('1-C15a: switching the agent mid-conversation adds the line "Agente trocado para <Agente>"', async () => {
    const bridge = await abrirInicio()
    const base = await abrirConversa(bridge)
    await responder(bridge, base, 'Resposta do Claude.')
    fireEvent.pointerDown(
      within(base.pagina).getByRole('button', { name: /^Agente da conversa:/ }),
      {
        button: 0,
        ctrlKey: false,
        pointerType: 'mouse'
      }
    )
    fireEvent.click(await screen.findByRole('menuitemradio', { name: /Devin/ }))
    expect(
      await within(mensagens(base.pagina)).findByText('Agente trocado para Devin')
    ).toBeTruthy()
  })

  it('1-C15b: after the switch, the next message goes to the new agent — the turn leaves with its id', async () => {
    const bridge = await abrirInicio()
    const base = await abrirConversa(bridge)
    await responder(bridge, base, 'Resposta do Claude.')
    expect(bridge.send).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({ agentId: 'claude-cli' })
    )
    fireEvent.pointerDown(
      within(base.pagina).getByRole('button', { name: /^Agente da conversa:/ }),
      {
        button: 0,
        ctrlKey: false,
        pointerType: 'mouse'
      }
    )
    fireEvent.click(await screen.findByRole('menuitemradio', { name: /Devin/ }))
    await within(mensagens(base.pagina)).findByText('Agente trocado para Devin')
    await enviarPor(base.pagina, 'E agora, Devin?')
    await waitFor(() =>
      expect(bridge.send).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.objectContaining({ agentId: 'devin' })
      )
    )
    expect(
      (bridge.conversa.planejarConversa as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0]
    ).toMatchObject({ agente: expect.objectContaining({ id: 'devin' }) })
  })

  it('1-C17a: a turn whose stream carries tools, command output, paths, MCP, git and a permission request shows only the reply’s text', async () => {
    const bridge = await abrirInicio()
    // What the agent does underneath travels on the window's agent stream —
    // the Chat's. The module neither listens there nor is handed any of it.
    const ouvintes: Array<(e: unknown) => void> = []
    window.hive.agent.onEvent = vi.fn((ouvinte: (e: unknown) => void) => {
      ouvintes.push(ouvinte)
      return () => {}
    }) as never
    const base = await abrirConversa(bridge)
    const porBaixo = [
      {
        type: 'tool',
        phase: 'start',
        toolId: 't1',
        name: 'Bash',
        detail: 'git status --porcelain',
        turnId: base.turnId
      },
      {
        type: 'tool',
        phase: 'end',
        toolId: 't1',
        name: 'Bash',
        output: 'M relatorios/likert/x.md',
        turnId: base.turnId
      },
      {
        type: 'tool',
        phase: 'start',
        toolId: 't2',
        name: 'Read',
        filePath: '/home/marina/Documentos/Design Studio/Câmbio/relatorios/likert/x.md',
        turnId: base.turnId
      },
      {
        type: 'mcp',
        servers: [{ name: 'hive_approvals', status: 'connected', tools: ['approve'] }],
        turnId: base.turnId
      },
      {
        type: 'approval',
        requestId: 'r1',
        tool: 'Write',
        input: { file_path: '/etc/hosts' },
        turnId: base.turnId
      }
    ]
    await act(async () => {
      for (const e of porBaixo) for (const ouvinte of ouvintes) ouvinte(e)
    })
    await responder(bridge, base, 'As Dores que mais crescem são duas.')
    const log = mensagens(base.pagina)
    const texto = log.textContent ?? ''
    expect(texto).toContain('As Dores que mais crescem são duas.')
    for (const proibido of [
      'Bash',
      'git',
      'relatorios/likert',
      '/home/marina',
      'hive_approvals',
      'MCP',
      '/etc/hosts',
      'Write',
      'Permitir'
    ]) {
      expect(texto).not.toContain(proibido)
    }
    expect(within(base.pagina).queryByRole('button', { name: /Permitir|Aprovar|Negar/ })).toBeNull()
    expect(window.hive.agent.onEvent).not.toHaveBeenCalled()
  })

  it('1-CU2a: with the agent signed out, the conversation shows the Hive chat’s own account notice and repair', async () => {
    let conectar: (ok: boolean) => void = () => {}
    const claudeAuth = {
      connect: vi.fn(() => new Promise<boolean>((resolve) => (conectar = resolve)))
    } as unknown as ClaudeAuthSession
    const bridge = await abrirInicio(CAMBIO, { claudeAuth })
    const base = await abrirConversa(bridge)
    await act(async () =>
      bridge.emitirConversa(evento(base, { estado: 'falhou', erro: 'claude-auth:signed-out' }))
    )
    const alerta = await within(base.pagina).findByRole('alert')
    expect(alerta.textContent).toContain(
      'Sua conta Claude não está conectada — por isso a resposta parou.'
    )
    fireEvent.click(within(alerta).getByRole('button', { name: 'Conectar conta' }))
    expect(claudeAuth.connect).toHaveBeenCalled()
    expect(within(alerta).getByRole('button', { name: /Conectando/ })).toBeTruthy()

    // The account came back: the question goes out again, by itself.
    const planejar = bridge.conversa.planejarConversa as ReturnType<typeof vi.fn>
    const antes = planejar.mock.calls.length
    await act(async () => conectar(true))
    await waitFor(() => expect(planejar.mock.calls.length).toBe(antes + 1))
    expect(planejar.mock.calls.at(-1)?.[0]).toMatchObject({
      conversa: base.conversa,
      texto: 'Quais Dores crescem mais?'
    })
  })

  it('1-CU2b: a turn that fails midway leaves "Não consegui responder agora. Tente de novo." and none of the agent’s raw words', async () => {
    const bridge = await abrirInicio()
    const base = await abrirConversa(bridge)
    await act(async () => {
      bridge.emitirConversa(evento(base, { estado: 'escrevendo', texto: 'Comecei a responder' }))
      bridge.emitirConversa(
        evento(base, { estado: 'falhou', erro: 'Error: spawn claude ENOENT (exit 127)' })
      )
    })
    const log = mensagens(base.pagina)
    expect(
      await within(log).findByText('Não consegui responder agora. Tente de novo.')
    ).toBeTruthy()
    expect(base.pagina.textContent).not.toContain('ENOENT')
    expect(base.pagina.textContent).not.toContain('exit 127')
  })
})
