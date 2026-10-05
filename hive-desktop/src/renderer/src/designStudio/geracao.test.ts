// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { relatorio, renderModule, stubBridge, type Bridge } from './__tests__/fixtures'
import type { DesignRoute } from './routes'

/**
 * Asking for a Relatório (criteria 12–16): one `agent.send` with the module's
 * default agent and the Produto's scope; the four steps where it was asked;
 * the notices at the end; the way back after a failure; one at a time.
 */

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const LEITURA = 'Câmbio/relatorios/likert/2026-10-04-90d.md'

/** The three requests lote 2 builds, each from its own page. ("Gerar" on the home is lote 3's.) */
const PEDIDOS: Array<[string, DesignRoute, () => HTMLElement, string, string]> = [
  [
    '"Gerar" in Relatórios',
    { pagina: 'relatorios' },
    () => screen.getByRole('button', { name: 'Gerar o Relatório de Voz do Cliente de Câmbio' }),
    'Câmbio',
    'voz'
  ],
  [
    '"Gerar Relatório de <Fonte>" in Dores',
    { pagina: 'dores' },
    () => screen.getByRole('button', { name: 'Gerar Relatório de FullStory' }),
    'Câmbio',
    'fullstory'
  ],
  [
    '"Gerar de novo" in the Leitura',
    { pagina: 'relatorio', relatorio: LEITURA },
    () => screen.getByRole('button', { name: /Gerar de novo/ }),
    'Câmbio',
    'likert'
  ]
]

/** The module at `route` with a Câmbio Likert Relatório in use, once the data landed. */
async function open(
  route: DesignRoute,
  options: Parameters<typeof stubBridge>[0] = {}
): Promise<Bridge> {
  const bridge = stubBridge({
    relatorios: [relatorio('Câmbio', 'likert', [{ tela: 'Confirmar' }])],
    ...options
  })
  renderModule(route)
  await waitFor(() => expect(bridge.dados).toHaveBeenCalled())
  await screen.findAllByText(/./)
  await act(async () => {})
  return bridge
}

describe('asking for a Relatório', () => {
  it.each(PEDIDOS)(
    'C12a: %s makes exactly one agent.send with the module default agent, the Produto’s scope and a text naming the Fonte’s skill',
    async (_pedido, route, button, produto, fonte) => {
      const bridge = await open(route)
      fireEvent.click(await waitFor(button))
      await waitFor(() => expect(bridge.send).toHaveBeenCalledTimes(1))
      expect(bridge.planejarGeracao).toHaveBeenCalledWith({
        produto,
        fonte,
        agente: { id: 'claude-cli', nome: 'Claude', modelo: 'sonnet' }
      })
      const [texto, opts] = bridge.send.mock.calls[0] as [string, Record<string, unknown>]
      expect(texto).toContain(`relatorio-${fonte}`)
      expect(opts).toMatchObject({
        agentId: 'claude-cli',
        model: 'sonnet',
        turnId: 'turno-1',
        freshSession: true,
        scope: {
          cwd: `/docs/Design Studio/${produto}`,
          writeRoots: [`/docs/Design Studio/${produto}/relatorios`]
        }
      })
    }
  )

  it.each([1, 2, 3, 4])(
    'C12b: with progress at %i, the place of the request shows the four steps — the current one aria-current="step", the earlier ones ✓, the later ones neither',
    async (passo) => {
      const bridge = await open({ pagina: 'dores' })
      fireEvent.click(screen.getByRole('button', { name: 'Gerar Relatório de FullStory' }))
      await waitFor(() => expect(bridge.send).toHaveBeenCalled())
      act(() =>
        bridge.emit({
          turnId: 'turno-1',
          produto: 'Câmbio',
          fonte: 'fullstory',
          estado: 'gerando',
          passo
        })
      )

      const column = screen.getByRole('region', { name: 'FullStory' })
      const steps = Array.from(column.querySelectorAll<HTMLElement>('.ds-passo'))
      expect(steps.map((step) => step.textContent?.replace('concluído', ''))).toEqual([
        'Lendo 48.300 sessões',
        'Agrupando por tema',
        'Ranqueando as Dores',
        'Escrevendo a narrativa'
      ])
      steps.forEach((step, index) => {
        const n = index + 1
        const current = step.getAttribute('aria-current') === 'step'
        const checked = step.querySelector('.ds-passo-check') !== null
        if (n < passo) expect([current, checked]).toEqual([false, true])
        else if (n === passo) expect([current, checked]).toEqual([true, false])
        else expect([current, checked]).toEqual([false, false])
      })
      // The button it replaced is gone while it runs.
      expect(
        within(column).queryByRole('button', { name: 'Gerar Relatório de FullStory' })
      ).toBeNull()
    }
  )

  it('C12c: while it runs, the Fonte’s row in Relatórios shows "Gerando… <n> de 4" instead of "Gerar"', async () => {
    const bridge = await open({ pagina: 'relatorios' })
    fireEvent.click(
      screen.getByRole('button', { name: 'Gerar o Relatório de Voz do Cliente de Câmbio' })
    )
    await waitFor(() => expect(bridge.send).toHaveBeenCalled())
    act(() =>
      bridge.emit({
        turnId: 'turno-1',
        produto: 'Câmbio',
        fonte: 'voz',
        estado: 'gerando',
        passo: 3
      })
    )
    const row = screen.getAllByText('Voz do Cliente')[0].closest('.ds-rel-linha') as HTMLElement
    expect(within(row).getByRole('status').textContent).toBe('Gerando… 3 de 4')
    expect(within(row).queryByRole('button', { name: /^Gerar/ })).toBeNull()
    // Every other row keeps its own action.
    expect(
      screen.getByRole('button', { name: 'Gerar o Relatório de FullStory de Câmbio' })
    ).toBeTruthy()
  })

  it.each([
    [6, 'Relatório de FullStory pronto · 6 Dores ranqueadas'],
    [1, 'Relatório de FullStory pronto · 1 Dor ranqueada']
  ])('C13d: at the end, the notice "%s"-style appears', async (dores, aviso) => {
    const bridge = await open({ pagina: 'dores' })
    fireEvent.click(screen.getByRole('button', { name: 'Gerar Relatório de FullStory' }))
    await waitFor(() => expect(bridge.send).toHaveBeenCalled())
    act(() =>
      bridge.emit({
        turnId: 'turno-1',
        produto: 'Câmbio',
        fonte: 'fullstory',
        estado: 'pronto',
        relatorio: 'Câmbio/relatorios/fullstory/2026-10-04-90d.md',
        dores
      })
    )
    expect(await screen.findByText(aviso)).toBeTruthy()
  })

  it('C14b: after "Gerar de novo", Dores, Relatórios and the data the home reads use the new file’s Dores, and none of the old one', async () => {
    const antigo = relatorio(
      'Câmbio',
      'likert',
      [{ titulo: 'Dor do arquivo antigo', tela: 'Confirmar' }],
      {
        destaque: 'destaque antigo'
      }
    )
    const novo = relatorio(
      'Câmbio',
      'likert',
      [{ titulo: 'Dor do arquivo novo', tela: 'Revisar' }],
      {
        caminho: 'Câmbio/relatorios/likert/2026-10-04-90d-2.md',
        destaque: 'destaque novo',
        geradoEm: '2026-10-04T15:00:00.000Z'
      }
    )
    const bridge = stubBridge({ relatorios: [antigo] })
    renderModule({ pagina: 'relatorio', relatorio: antigo.caminho })
    fireEvent.click(await screen.findByRole('button', { name: /Gerar de novo/ }))
    await waitFor(() => expect(bridge.send).toHaveBeenCalled())
    bridge.setRelatorios([novo])
    act(() =>
      bridge.emit({
        turnId: 'turno-1',
        produto: 'Câmbio',
        fonte: 'likert',
        estado: 'pronto',
        relatorio: novo.caminho,
        dores: 1
      })
    )
    await waitFor(() => expect(bridge.dados).toHaveBeenCalledTimes(2))
    cleanup()

    // Dores, on the same bridge — now answering the new file.
    renderModule({ pagina: 'dores' })
    expect(await screen.findByText('Dor do arquivo novo')).toBeTruthy()
    expect(screen.queryByText('Dor do arquivo antigo')).toBeNull()
    cleanup()
    // Relatórios.
    renderModule({ pagina: 'relatorios' })
    expect(await screen.findByText('Destaque novo')).toBeTruthy()
    expect(screen.queryByText('Destaque antigo')).toBeNull()
    // The data the home's "Dores em alta" reads (lote 3): the most recent per Fonte.
    const lido = (await bridge.dados.mock.results[bridge.dados.mock.results.length - 1].value) as {
      relatorios: Array<{ caminho: string }>
    }
    expect(lido.relatorios.map((r) => r.caminho)).toEqual([novo.caminho])
  })

  it.each([
    ['erro', 'O agente parou antes de terminar o Relatório de FullStory. Nada foi publicado.'],
    ['interrompido', 'A geração do Relatório de FullStory foi interrompida. Nada foi publicado.'],
    ['formato', 'O agente não entregou um Relatório de FullStory completo. Nada foi publicado.']
  ] as const)(
    'C15b: after a failure (%s), the place of the request goes back to "Gerar"',
    async (motivo, texto) => {
      const bridge = await open({ pagina: 'dores' })
      fireEvent.click(screen.getByRole('button', { name: 'Gerar Relatório de FullStory' }))
      await waitFor(() => expect(bridge.send).toHaveBeenCalled())
      act(() =>
        bridge.emit({
          turnId: 'turno-1',
          produto: 'Câmbio',
          fonte: 'fullstory',
          estado: 'gerando',
          passo: 2
        })
      )
      expect(
        screen.getByRole('region', { name: 'FullStory' }).querySelector('.ds-passo')
      ).not.toBeNull()
      act(() =>
        bridge.emit({
          turnId: 'turno-1',
          produto: 'Câmbio',
          fonte: 'fullstory',
          estado: 'falhou',
          motivo
        })
      )
      const column = screen.getByRole('region', { name: 'FullStory' })
      expect(column.querySelector('.ds-passo')).toBeNull()
      expect(
        within(column).getByRole('button', { name: 'Gerar Relatório de FullStory' })
      ).toBeTruthy()
      // …and the reason is on screen, beside it.
      expect(await screen.findByText(texto)).toBeTruthy()
    }
  )

  it('C15b: after a failure of "Gerar de novo", the place shows the previous Relatório', async () => {
    const bridge = await open({ pagina: 'relatorio', relatorio: LEITURA })
    fireEvent.click(screen.getByRole('button', { name: /Gerar de novo/ }))
    await waitFor(() => expect(bridge.send).toHaveBeenCalled())
    act(() =>
      bridge.emit({
        turnId: 'turno-1',
        produto: 'Câmbio',
        fonte: 'likert',
        estado: 'gerando',
        passo: 2
      })
    )
    expect(document.querySelector('.ds-passos')).not.toBeNull()
    act(() =>
      bridge.emit({
        turnId: 'turno-1',
        produto: 'Câmbio',
        fonte: 'likert',
        estado: 'falhou',
        motivo: 'erro'
      })
    )
    expect(document.querySelector('.ds-passos')).toBeNull()
    expect(screen.getByText('Primeiro parágrafo da narrativa.')).toBeTruthy()
  })

  it.each([
    ['erro', 'O agente parou antes de terminar o Relatório de FullStory. Nada foi publicado.'],
    ['interrompido', 'A geração do Relatório de FullStory foi interrompida. Nada foi publicado.'],
    ['formato', 'O agente não entregou um Relatório de FullStory completo. Nada foi publicado.']
  ] as const)(
    'C15c: a failure (%s) shows its reason in pt-BR, no technical output, and "Tentar de novo" sends again for the same Fonte',
    async (motivo, texto) => {
      const bridge = await open({ pagina: 'dores' })
      fireEvent.click(screen.getByRole('button', { name: 'Gerar Relatório de FullStory' }))
      await waitFor(() => expect(bridge.send).toHaveBeenCalledTimes(1))
      act(() =>
        bridge.emit({
          turnId: 'turno-1',
          produto: 'Câmbio',
          fonte: 'fullstory',
          estado: 'falhou',
          motivo
        })
      )
      const aviso = (await screen.findByText(texto)).closest('.ds-aviso') as HTMLElement
      expect(aviso.textContent).not.toMatch(/exit|code|stderr|claude|\/|\\/i)
      fireEvent.click(within(aviso).getByRole('button', { name: 'Tentar de novo' }))
      await waitFor(() => expect(bridge.send).toHaveBeenCalledTimes(2))
      expect(bridge.planejarGeracao.mock.calls[1][0]).toMatchObject({
        produto: 'Câmbio',
        fonte: 'fullstory'
      })
    }
  )

  it('C16: with a generation running, a second request — any Produto or Fonte — shows "Espere o Relatório em andamento terminar" and sends nothing more', async () => {
    const bridge = await open({ pagina: 'dores' })
    fireEvent.click(screen.getByRole('button', { name: 'Gerar Relatório de FullStory' }))
    // Before the first even reached the agent: the lock is synchronous.
    fireEvent.click(screen.getByRole('button', { name: 'Gerar Relatório de Voz do Cliente' }))
    await waitFor(() => expect(bridge.send).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('Espere o Relatório em andamento terminar')).toBeTruthy()
    // Another Produto, while the first runs.
    fireEvent.click(screen.getByRole('radio', { name: 'Pix' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Gerar Relatório de Likert' }))
    await act(async () => {})
    expect(bridge.send).toHaveBeenCalledTimes(1)
    expect(bridge.planejarGeracao).toHaveBeenCalledTimes(1)
  })
})

describe('the generation’s edges', () => {
  it('a send that fails forgets the plan and says so, ready for another try', async () => {
    const bridge = await open(
      { pagina: 'dores' },
      { send: async () => Promise.reject(new Error('ipc')) }
    )
    fireEvent.click(screen.getByRole('button', { name: 'Gerar Relatório de FullStory' }))
    expect(
      await screen.findByText(
        'O agente parou antes de terminar o Relatório de FullStory. Nada foi publicado.'
      )
    ).toBeTruthy()
    expect(bridge.abandonarGeracao).toHaveBeenCalledWith('turno-1')
    expect(screen.getByRole('button', { name: 'Gerar Relatório de FullStory' })).toBeTruthy()
  })

  it('a plan main refuses (another window is generating) says "Espere…"', async () => {
    const bridge = await open({ pagina: 'dores' })
    bridge.planejarGeracao.mockResolvedValueOnce({ ok: false, motivo: 'ocupado' })
    fireEvent.click(screen.getByRole('button', { name: 'Gerar Relatório de FullStory' }))
    expect(await screen.findByText('Espere o Relatório em andamento terminar')).toBeTruthy()
    expect(bridge.send).not.toHaveBeenCalled()
  })

  it('a plan that cannot be made at all fails the request like an error', async () => {
    const bridge = await open({ pagina: 'dores' })
    bridge.planejarGeracao.mockRejectedValueOnce(new Error('catalog'))
    fireEvent.click(screen.getByRole('button', { name: 'Gerar Relatório de FullStory' }))
    expect(await screen.findByText(/^O agente parou antes de terminar/)).toBeTruthy()
  })

  it('picks up a generation already in flight when the module opens', async () => {
    stubBridge({ relatorios: [] })
    window.hive.designStudio.geracaoAtual = vi.fn(async () => ({
      turnId: 'turno-9',
      produto: 'Câmbio',
      fonte: 'voz' as const,
      estado: 'gerando' as const,
      passo: 2
    }))
    renderModule({ pagina: 'dores' })
    const column = await screen.findByRole('region', { name: 'Voz do Cliente' })
    await waitFor(() =>
      expect(column.querySelector('[aria-current="step"]')?.textContent).toBe('Agrupando por tema')
    )
  })

  it('runs on Devin with no model when Devin is the Hive default without a pin', async () => {
    const bridge = await open({ pagina: 'dores' }, { hiveDefault: 'devin' })
    fireEvent.click(screen.getByRole('button', { name: 'Gerar Relatório de FullStory' }))
    await waitFor(() => expect(bridge.send).toHaveBeenCalled())
    const [, opts] = bridge.send.mock.calls[0] as [string, Record<string, unknown>]
    expect(opts.agentId).toBe('devin')
    expect(opts).not.toHaveProperty('model')
  })

  it('dismisses a notice from its own button', async () => {
    const bridge = await open({ pagina: 'dores' })
    fireEvent.click(screen.getByRole('button', { name: 'Gerar Relatório de FullStory' }))
    await waitFor(() => expect(bridge.send).toHaveBeenCalled())
    act(() =>
      bridge.emit({
        turnId: 'turno-1',
        produto: 'Câmbio',
        fonte: 'fullstory',
        estado: 'falhou',
        motivo: 'erro'
      })
    )
    const aviso = (await screen.findByText(/^O agente parou/)).closest('.ds-aviso') as HTMLElement
    fireEvent.click(within(aviso).getByRole('button', { name: 'Dispensar aviso' }))
    await waitFor(() => expect(screen.queryByText(/^O agente parou/)).toBeNull())
  })
})

describe('the notices over time', () => {
  it('a "pronto" notice goes away on its own; a failure stays until dismissed', async () => {
    const bridge = await open({ pagina: 'dores' })
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      act(() =>
        bridge.emit({
          turnId: 't',
          produto: 'Câmbio',
          fonte: 'voz',
          estado: 'pronto',
          relatorio: 'Câmbio/relatorios/voz/x.md',
          dores: 2
        })
      )
      act(() =>
        bridge.emit({
          turnId: 'u',
          produto: 'Câmbio',
          fonte: 'voz',
          estado: 'falhou',
          motivo: 'erro'
        })
      )
      expect(
        screen.getByText('Relatório de Voz do Cliente pronto · 2 Dores ranqueadas')
      ).toBeTruthy()
      act(() => {
        vi.advanceTimersByTime(7000)
      })
      expect(
        screen.queryByText('Relatório de Voz do Cliente pronto · 2 Dores ranqueadas')
      ).toBeNull()
      expect(
        screen.getByText(/^O agente parou antes de terminar o Relatório de Voz do Cliente/)
      ).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })
})
