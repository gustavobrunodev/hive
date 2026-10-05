// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react'
import { activePage, relatorio, renderModule, stubBridge, type DorSpec } from './__tests__/fixtures'
import { columnDores, ondeDoi, visibleDores } from './relatorioModel'

/**
 * P8 — the Dores page (criteria 18–20): the Produto's title and picker, one
 * column per Fonte with its Relatório's top five as notes, the empty column's
 * way to generate, and "Onde dói".
 */

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

/** The page once its data landed. */
async function openDores(relatorios = defaultRelatorios()): Promise<void> {
  stubBridge({ relatorios })
  renderModule({ pagina: 'dores' })
  await screen.findByRole('heading', { level: 1, name: 'Dores de Câmbio' })
}

function defaultRelatorios(): ReturnType<typeof relatorio>[] {
  return [
    relatorio('Câmbio', 'likert', [
      { tela: 'Confirmar', impacto: 'alto' },
      { tela: 'Acompanhar', impacto: 'alto' },
      { tela: 'Revisar' }
    ]),
    relatorio('Câmbio', 'voz', [
      { tela: 'Acompanhar', impacto: 'alto' },
      { tela: 'Acompanhar' },
      { tela: undefined, impacto: 'baixo' }
    ]),
    relatorio('Câmbio', 'fullstory', [{ tela: 'Confirmar' }, { tela: 'Acompanhar' }])
  ]
}

function column(fonte: string): HTMLElement {
  return screen.getByRole('region', { name: fonte })
}

function notes(region: HTMLElement): HTMLElement[] {
  return Array.from(region.querySelectorAll<HTMLElement>('.hds-note'))
}

describe('Dores', () => {
  it('C18a: shows "Dores de <Produto>", the prototype subtitle, the Produto picker and the three columns in order', async () => {
    await openDores()
    const page = activePage()
    expect(
      within(page).getByText(
        'O que os clientes sentiram, disseram e fizeram, uma coluna por Fonte. Toque numa nota para ver as Evidências; cite no chat para o agente resolver.'
      )
    ).toBeTruthy()
    const picker = within(page).getByRole('radiogroup', { name: 'Produto' })
    expect(
      within(picker)
        .getAllByRole('radio')
        .map((r) => r.textContent)
    ).toEqual(['Câmbio', 'Extrato', 'Pix'])
    const headings = within(page)
      .getAllByRole('heading', { level: 2 })
      .map((h) => h.textContent)
    expect(headings).toEqual(['Likert', 'Voz do Cliente', 'FullStory'])
  })

  it('switches Produto with the picker, and the title follows', async () => {
    await openDores()
    fireEvent.click(screen.getByRole('radio', { name: 'Pix' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Dores de Pix' })).toBeTruthy()
    // Pix has no Relatório in this case: every column offers to generate.
    expect(screen.getAllByRole('button', { name: /^Gerar Relatório de / })).toHaveLength(3)
  })

  it.each([
    ['Likert', '6.912 respostas no período', 'Câmbio/relatorios/likert/2026-10-04-90d.md'],
    ['Voz do Cliente', '3.205 ligações no período', 'Câmbio/relatorios/voz/2026-10-04-90d.md'],
    ['FullStory', '48.300 sessões no período', 'Câmbio/relatorios/fullstory/2026-10-04-90d.md']
  ])(
    'C18b: the %s column shows the Fonte, "%s" and the "Relatório" link to its Leitura',
    async (fonte, meta, caminho) => {
      const navigate = vi.fn()
      stubBridge({ relatorios: defaultRelatorios() })
      renderModule({ pagina: 'dores' }, navigate)
      await screen.findByRole('heading', { level: 1, name: 'Dores de Câmbio' })
      const region = column(fonte)
      const header = region.querySelector('.ds-coluna-cab') as HTMLElement
      expect(within(header).getByRole('heading', { name: fonte })).toBeTruthy()
      expect(within(header).getByText(meta)).toBeTruthy()
      fireEvent.click(within(header).getByRole('button', { name: 'Relatório' }))
      expect(navigate).toHaveBeenCalledWith({ pagina: 'relatorio', relatorio: caminho })
    }
  )

  it('C18c: a Relatório of 7 Dores shows 5 notes, ranks 1 to 5 in order', async () => {
    const sete: DorSpec[] = Array.from({ length: 7 }, (_, i) => ({
      titulo: `Dor ${i + 1}`,
      tela: 'Simular'
    }))
    const r = relatorio('Câmbio', 'likert', sete)
    // Stored out of order: the column orders by rank, not by file order.
    r.dores.reverse()
    await openDores([r])
    expect(
      notes(column('Likert')).map((n) => n.querySelector('.hds-note-title')?.textContent)
    ).toEqual(['Dor 1', 'Dor 2', 'Dor 3', 'Dor 4', 'Dor 5'])
    expect(columnDores(r).map((d) => d.rank)).toEqual([1, 2, 3, 4, 5])
  })

  it.each([
    ['alto', 'Alto'],
    ['medio', 'Médio'],
    ['baixo', 'Baixo']
  ] as const)(
    'C18d: a note shows title, volume with unit, impact %s → "%s" and trend, as a SourceNote of the column’s Fonte',
    async (impacto, palavra) => {
      await openDores([
        relatorio('Câmbio', 'voz', [
          {
            titulo: 'O estorno não avisa',
            impacto,
            volume: 1284,
            tendencia: 31,
            tela: 'Acompanhar'
          }
        ])
      ])
      const [note] = notes(column('Voz do Cliente'))
      expect(note.getAttribute('data-fonte')).toBe('voz')
      expect(note.style.background).toBe('var(--source-voz-bg)')
      expect(note.textContent).toContain('O estorno não avisa')
      expect(note.textContent).toContain('1.284 ligações')
      expect(note.querySelector('.hds-note-impact')?.textContent).toBe(`Impacto ${palavra}`)
      expect(note.querySelector('.hds-note-trend')?.textContent).toBe('31%')
    }
  )

  it('C18d: a falling trend and a flat one read as such', async () => {
    await openDores([
      relatorio('Câmbio', 'likert', [
        { tendencia: -3, tela: 'Simular' },
        { tendencia: 0, tela: 'Simular' }
      ])
    ])
    const [cai, igual] = notes(column('Likert'))
    expect(cai.querySelector('.hds-note-trend').getAttribute('data-trend')).toBe('down')
    expect(cai.querySelector('.hds-note-trend')?.textContent).toBe('3%')
    expect(igual.querySelector('.hds-note-trend')?.textContent).toBe('estável')
  })

  it('C19: a Fonte with no Relatório says so, with the sentence and "Gerar Relatório de <Fonte>"', async () => {
    await openDores([relatorio('Câmbio', 'likert', [{ tela: 'Simular' }])])
    const region = column('FullStory')
    expect(within(region).getByText('Ainda não há Relatório de FullStory.')).toBeTruthy()
    expect(
      within(region).getByText(
        'O agente lê os dados do período, agrupa por tema e ranqueia as Dores.'
      )
    ).toBeTruthy()
    expect(
      within(region).getByRole('button', { name: 'Gerar Relatório de FullStory' })
    ).toBeTruthy()
    // …and no "Relatório" link, since there is none to open.
    expect(within(region).queryByRole('button', { name: 'Relatório' })).toBeNull()
  })

  it('C20a: "Onde dói" has one button per journey screen (6), counting the visible Dores; a Dor with no screen counts nowhere', async () => {
    await openDores()
    const group = screen.getByRole('group', { name: 'Onde dói: telas da jornada' })
    const buttons = within(group).getAllByRole('button')
    expect(buttons.map((b) => b.firstChild?.textContent)).toEqual([
      'Simular',
      'Revisar',
      'Beneficiário',
      'Confirmar',
      'Acompanhar',
      'Comprovante'
    ])
    const counts = buttons.map((b) => b.querySelector('.ds-onde-n')?.textContent)
    // Acompanhar: likert 1 + voz 2 + fullstory 1; Confirmar: likert 1 + fullstory 1;
    // Revisar: likert 1. The voz Dor with no screen is in no count.
    expect(counts).toEqual(['0', '1', '0', '2', '4', '0'])
  })

  it('C20b: the screen with the most Dores is marked the hottest, and the empty ones are disabled', async () => {
    await openDores()
    const acompanhar = screen.getByRole('button', {
      name: 'Acompanhar: 4 Dores, a tela mais quente'
    })
    expect(acompanhar.hasAttribute('data-hot')).toBe(true)
    expect(
      screen.getByRole('button', { name: 'Confirmar: 2 Dores' }).hasAttribute('data-hot')
    ).toBe(false)
    for (const name of ['Simular: 0 Dores', 'Beneficiário: 0 Dores', 'Comprovante: 0 Dores']) {
      expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true)
    }
    expect(
      (screen.getByRole('button', { name: 'Revisar: 1 Dor' }) as HTMLButtonElement).disabled
    ).toBe(false)
  })

  it('C20c: choosing a screen leaves only its Dores in the three columns, presses it, and "Ver todas" undoes it', async () => {
    await openDores()
    const confirmar = screen.getByRole('button', { name: 'Confirmar: 2 Dores' })
    fireEvent.click(confirmar)
    expect(confirmar.getAttribute('aria-pressed')).toBe('true')
    expect(notes(column('Likert'))).toHaveLength(1)
    expect(notes(column('FullStory'))).toHaveLength(1)
    expect(notes(column('Voz do Cliente'))).toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: 'Ver todas' }))
    expect(confirmar.getAttribute('aria-pressed')).toBe('false')
    expect(notes(column('Likert'))).toHaveLength(3)
    expect(screen.queryByRole('button', { name: 'Ver todas' })).toBeNull()

    // Pressing the chosen screen again also undoes it.
    fireEvent.click(confirmar)
    fireEvent.click(confirmar)
    expect(confirmar.getAttribute('aria-pressed')).toBe('false')
  })

  it('C20d: with a screen chosen, a column with no Dor there says "Nenhuma Dor de <Fonte> na tela <Tela>."', async () => {
    await openDores()
    fireEvent.click(screen.getByRole('button', { name: 'Revisar: 1 Dor' }))
    expect(
      within(column('Voz do Cliente')).getByText('Nenhuma Dor de Voz do Cliente na tela Revisar.')
    ).toBeTruthy()
    expect(
      within(column('FullStory')).getByText('Nenhuma Dor de FullStory na tela Revisar.')
    ).toBeTruthy()
  })

  it('C20e: with no Relatório in the Produto, "Onde dói" is not rendered', async () => {
    await openDores([])
    expect(screen.queryByRole('group', { name: 'Onde dói: telas da jornada' })).toBeNull()
  })

  it('forgets the chosen screen when the Produto changes', async () => {
    await openDores([...defaultRelatorios(), relatorio('Pix', 'likert', [{ tela: 'Valor' }])])
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar: 2 Dores' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Pix' }))
    await screen.findByRole('heading', { level: 1, name: 'Dores de Pix' })
    expect(screen.queryByRole('button', { name: 'Ver todas' })).toBeNull()
    expect(notes(column('Likert'))).toHaveLength(1)
  })

  it('carries the "Dados de exemplo" seal in its header once loaded, the navigation hidden', async () => {
    await openDores()
    const header = activePage().querySelector('header') as HTMLElement
    expect(within(header).getByText('Dados de exemplo')).toBeTruthy()
  })

  it('stays on its frame while the data has not arrived', () => {
    stubBridge()
    window.hive.designStudio.dados = vi.fn(() => new Promise<never>(() => {}))
    renderModule({ pagina: 'dores' })
    expect(screen.getByRole('heading', { level: 1, name: 'Dores' })).toBeTruthy()
  })

  it('counts "Onde dói" the way the rule says: per screen, hottest ties, zero disabled', () => {
    const r = relatorio('Câmbio', 'likert', [
      { tela: 'A' },
      { tela: 'B' },
      { tela: 'A' },
      { tela: 'B' }
    ])
    expect(ondeDoi(['A', 'B', 'C'], visibleDores([r]))).toEqual([
      { tela: 'A', contagem: 2, quente: true, desabilitada: false },
      { tela: 'B', contagem: 2, quente: true, desabilitada: false },
      { tela: 'C', contagem: 0, quente: false, desabilitada: true }
    ])
    expect(ondeDoi(['A'], [])).toEqual([
      { tela: 'A', contagem: 0, quente: false, desabilitada: true }
    ])
  })

  it('stays on its frame with a catalog of no Produto, and reads a catalog without a Fonte’s entry as blank', async () => {
    const bridge = stubBridge({ relatorios: defaultRelatorios() })
    bridge.dados.mockResolvedValueOnce({
      catalogo: { produtos: [], fontes: [] },
      relatorios: [],
      volumes: {}
    })
    renderModule({ pagina: 'dores' })
    await act(async () => {})
    expect(screen.getByRole('heading', { level: 1, name: 'Dores' })).toBeTruthy()
    cleanup()

    bridge.dados.mockResolvedValueOnce({
      catalogo: {
        produtos: [{ id: 'cambio', nome: 'Câmbio', descricao: '', telas: [] }],
        fontes: []
      },
      relatorios: defaultRelatorios(),
      volumes: {}
    })
    renderModule({ pagina: 'dores' })
    await screen.findByRole('heading', { level: 1, name: 'Dores de Câmbio' })
    expect(within(column('Likert')).getByText('6.912 no período')).toBeTruthy()
    expect(
      screen
        .getByRole('group', { name: 'Onde dói: telas da jornada' })
        .querySelectorAll('.ds-onde-tela')
    ).toHaveLength(0)
  })
})
