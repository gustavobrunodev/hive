// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import {
  activePage,
  prepararDom,
  relatorio,
  renderModule,
  renderModuloVivo,
  stubBridge
} from './__tests__/fixtures'

/**
 * P12 — the Relatório as charts (criteria 26–27): the Leitura | Gráficos
 * switch, the filters, the line following the emphasis, and the insights.
 */

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const CAMINHO = 'Câmbio/relatorios/likert/2026-10-04-90d.md'

async function openGraficos(navigate = vi.fn()): Promise<void> {
  stubBridge({
    relatorios: [
      relatorio('Câmbio', 'likert', [
        { titulo: 'Dor A1', categoria: 'a', volume: 400 },
        { titulo: 'Dor B1', categoria: 'b', volume: 300 },
        { titulo: 'Dor A2', categoria: 'a', volume: 200 }
      ])
    ]
  })
  renderModule({ pagina: 'relatorio', relatorio: CAMINHO }, navigate)
  await screen.findByRole('radiogroup', { name: 'Visão do Relatório' })
  fireEvent.click(screen.getByRole('radio', { name: 'Gráficos' }))
}

function slider(): HTMLElement {
  return screen.getByRole('slider')
}

describe('Relatório · Gráficos', () => {
  it('C26: "Gráficos" then "Leitura" swaps the view and keeps the route on the same Relatório; back still goes to Relatórios', async () => {
    const navigate = vi.fn()
    await openGraficos(navigate)
    expect(screen.getByRole('figure', { name: 'Dores por categoria' })).toBeTruthy()
    expect(document.querySelector('.ds-leitura')).toBeNull()

    fireEvent.click(screen.getByRole('radio', { name: 'Leitura' }))
    expect(document.querySelector('.ds-leitura')).not.toBeNull()
    expect(screen.queryByRole('figure', { name: 'Dores por categoria' })).toBeNull()
    // The swap never touched the route.
    expect(navigate).not.toHaveBeenCalled()
    expect(activePage().dataset.page).toBe('relatorio')

    fireEvent.click(screen.getByRole('button', { name: 'Relatórios' }))
    expect(navigate).toHaveBeenCalledWith({ pagina: 'relatorios' })
  })

  it('C27a: the period (90, 60, 30 dias) and Dor ("Todas as Dores") filters; "Limpar filtro" only with a recorte, and it resets both', async () => {
    await openGraficos()
    const periodo = screen.getByRole('radiogroup', { name: 'Período' })
    expect(
      within(periodo)
        .getAllByRole('radio')
        .map((r) => r.textContent)
    ).toEqual(['90 dias', '60 dias', '30 dias'])
    expect(
      within(periodo).getByRole('radio', { name: '90 dias' }).getAttribute('aria-checked')
    ).toBe('true')
    const dor = screen.getByRole('combobox', { name: 'Dor' }) as HTMLSelectElement
    expect(dor.value).toBe('')
    expect(dor.options[dor.selectedIndex].textContent).toBe('Todas as Dores')
    expect(screen.queryByRole('button', { name: 'Limpar filtro' })).toBeNull()

    fireEvent.click(within(periodo).getByRole('radio', { name: '30 dias' }))
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtro' }))
    expect(
      within(periodo).getByRole('radio', { name: '90 dias' }).getAttribute('aria-checked')
    ).toBe('true')
    expect(screen.queryByRole('button', { name: 'Limpar filtro' })).toBeNull()

    fireEvent.change(dor, { target: { value: 'likert-2' } })
    expect(screen.getByText(/^“Dor B1” soma/)).toBeTruthy()
    fireEvent.click(within(periodo).getByRole('radio', { name: '60 dias' }))
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtro' }))
    expect(dor.value).toBe('')
    expect(
      within(periodo).getByRole('radio', { name: '90 dias' }).getAttribute('aria-checked')
    ).toBe('true')
    expect(screen.queryByRole('button', { name: 'Limpar filtro' })).toBeNull()
  })

  it('C27d: switching the emphasis on the bars switches the line’s series', async () => {
    await openGraficos()
    expect(slider().getAttribute('aria-label')).toMatch(
      /^Recorrência semanal de Categoria A: de 40 para 64 /
    )
    fireEvent.click(screen.getByRole('button', { name: /^Categoria B:/ }))
    expect(slider().getAttribute('aria-label')).toMatch(
      /^Recorrência semanal de Categoria B: de 30 para 18 /
    )
    expect(screen.getByRole('button', { name: /^Categoria B:/ }).getAttribute('aria-pressed')).toBe(
      'true'
    )
  })

  it('C27d: a filtered Dor puts its own weeks on the line, and its part on its category’s bar', async () => {
    await openGraficos()
    fireEvent.change(screen.getByRole('combobox', { name: 'Dor' }), {
      target: { value: 'likert-3' }
    })
    expect(slider().getAttribute('aria-label')).toMatch(
      /^Recorrência semanal de Dor A2: de 12 para 24 /
    )
    const bar = screen.getByRole('button', { name: /^Categoria A:/ })
    expect(bar.querySelector('.hds-bars-part')).not.toBeNull()
  })

  it('C27e: one insight per category, authored by the agent (logo + name), the one in focus aria-current', async () => {
    await openGraficos()
    const insights = screen.getByRole('region', { name: 'Insights por categoria' })
    expect(
      within(insights).getByText(
        'O que o Claude lê em cada categoria, com o próximo passo sugerido.'
      )
    ).toBeTruthy()
    const artigos = Array.from(insights.querySelectorAll<HTMLElement>('.ds-insight'))
    expect(artigos.map((a) => a.querySelector('h3')?.textContent)).toEqual([
      'Categoria A',
      'Categoria B'
    ])
    for (const artigo of artigos) {
      const autor = artigo.querySelector('.ds-insight-autor') as HTMLElement
      expect(autor.querySelector('svg')).not.toBeNull()
      expect(autor.textContent).toBe('Claude')
    }
    expect(artigos[0].textContent).toContain('Insight da categoria A.')
    expect(artigos[0].getAttribute('aria-current')).toBe('true')
    expect(artigos[1].hasAttribute('aria-current')).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: /^Categoria B:/ }))
    const depois = Array.from(insights.querySelectorAll<HTMLElement>('.ds-insight'))
    expect(depois[1].getAttribute('aria-current')).toBe('true')
    expect(depois[0].hasAttribute('aria-current')).toBe(false)
  })

  it('summarises the recorte in one paragraph', async () => {
    await openGraficos()
    expect(
      screen.getByText(
        /^Nos últimos 90 dias, as Dores deste Relatório somam .+ menções em 2 categorias\. Categoria A concentra \d+%\.$/
      )
    ).toBeTruthy()
  })
})

describe('Gráficos edges', () => {
  it.each(['Devin', 'Outro agente'])(
    'credits the insights to %s, with its mark or the neutral one',
    async (agente) => {
      stubBridge({
        relatorios: [relatorio('Câmbio', 'likert', [{}], { geradoPor: { agente, modelo: null } })]
      })
      renderModule({ pagina: 'relatorio', relatorio: CAMINHO })
      fireEvent.click(await screen.findByRole('radio', { name: 'Gráficos' }))
      const autor = document.querySelector('.ds-insight-autor') as HTMLElement
      expect(autor.textContent).toBe(agente)
      expect(autor.querySelector('svg')).not.toBeNull()
    }
  )

  it('draws a Relatório with no categories as empty charts, with no summary (Unresolved 13)', async () => {
    stubBridge({ relatorios: [relatorio('Câmbio', 'likert', [], { categorias: [] })] })
    renderModule({ pagina: 'relatorio', relatorio: CAMINHO })
    fireEvent.click(await screen.findByRole('radio', { name: 'Gráficos' }))
    expect(document.querySelector('.ds-graf-resumo')).toBeNull()
    expect(screen.getByRole('slider').getAttribute('aria-label')).toMatch(/de 0 para 0/)
  })

  it('moves the line with the keyboard, reading each week aloud', async () => {
    await openGraficos()
    const s = slider()
    fireEvent.focus(s)
    fireEvent.keyDown(s, { key: 'Home' })
    expect(s.getAttribute('aria-valuetext')).toBe('6 jul: 40')
  })
})

describe('an insight asks the agent (task 1)', () => {
  it('1-C20: "Perguntar ao agente" of an insight opens a conversa do Produto with "O que está por trás de “<título>” em <categoria>?", about the category’s heaviest Dor and citing it', async () => {
    prepararDom()
    const bridge = stubBridge({
      relatorios: [
        relatorio('Câmbio', 'likert', [
          { titulo: 'Dor A1', categoria: 'a', volume: 400 },
          { titulo: 'Dor B1', categoria: 'b', volume: 300 },
          { titulo: 'Dor A2', categoria: 'a', volume: 200 },
          { titulo: 'Dor B2', categoria: 'b', volume: 900 }
        ])
      ]
    })
    renderModuloVivo({ pagina: 'relatorio', relatorio: CAMINHO })
    await screen.findByRole('radiogroup', { name: 'Visão do Relatório' })
    fireEvent.click(screen.getByRole('radio', { name: 'Gráficos' }))
    const insight = (await screen.findAllByRole('article')).find(
      (article) => within(article).queryByRole('heading', { name: 'Categoria B' }) !== null
    ) as HTMLElement
    fireEvent.click(within(insight).getByRole('button', { name: 'Perguntar ao agente' }))

    await waitFor(() => expect(activePage().dataset.page).toBe('conversa'))
    // "Dor B1" is Categoria B's best-ranked Dor — B2 has more volume but ranks lower.
    expect(bridge.conversa.planejarConversa).toHaveBeenCalledWith(
      expect.objectContaining({
        produto: 'Câmbio',
        conversa: null,
        texto: 'O que está por trás de “Dor B1” em Categoria B?',
        citadas: [{ relatorio: CAMINHO, dor: 'likert-2' }]
      })
    )
    const conversa = activePage()
    expect(
      within(conversa).getByText('O que está por trás de “Dor B1” em Categoria B?')
    ).toBeTruthy()
    expect(within(conversa).getByRole('button', { name: 'Abrir a Dor “Dor B1”' })).toBeTruthy()
  })
})
