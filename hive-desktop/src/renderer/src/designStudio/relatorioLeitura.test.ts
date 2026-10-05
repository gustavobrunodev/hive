// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { activePage, relatorio, renderModule, stubBridge } from './__tests__/fixtures'

/**
 * P11 — the Relatório read as text (criteria 25 and 31).
 */

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const CAMINHO = 'Câmbio/relatorios/likert/2026-10-04-90d.md'

function likert(): ReturnType<typeof relatorio> {
  return relatorio(
    'Câmbio',
    'likert',
    [
      { titulo: 'A cotação muda', tela: 'Confirmar', impacto: 'alto', volume: 412, tendencia: 22 },
      { titulo: 'Sem tela', tela: undefined, impacto: 'baixo', volume: 133, tendencia: 0 }
    ],
    { destaque: '28% das respostas com nota 1 ou 2', geradoEm: '2026-09-29T11:40:00.000Z' }
  )
}

/** Every text node of the page, in document order, trimmed. */
function textsInOrder(root: HTMLElement): string[] {
  const out: string[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent?.trim()
    if (text) out.push(text)
  }
  return out
}

describe('Relatório · Leitura', () => {
  it('C25a: back, title, meta, highlight, the narrative in paragraphs, "Como foi feito." and "Dores ranqueadas · <n>" with each Dor’s line, in that DOM order', async () => {
    stubBridge({ relatorios: [likert()] })
    renderModule({ pagina: 'relatorio', relatorio: CAMINHO })
    await screen.findByText('28% das respostas com nota 1 ou 2.')
    const page = activePage()
    const texts = textsInOrder(page)
    const at = (needle: string | RegExp): number => {
      const index = texts.findIndex((text) =>
        typeof needle === 'string' ? text === needle : needle.test(text)
      )
      expect(index, String(needle)).toBeGreaterThanOrEqual(0)
      return index
    }
    const order = [
      at('Relatórios'),
      at('Relatório de Likert'),
      at(
        /^Câmbio · 7 jul a 4 out 2026 · gerado em 29 set 2026, \d{2}:\d{2} por Claude · dados de exemplo$/
      ),
      at('28% das respostas com nota 1 ou 2'),
      at('Primeiro parágrafo da narrativa.'),
      at('Segundo parágrafo da narrativa.'),
      at('Como foi feito.'),
      at('Dores ranqueadas'),
      at('· 2'),
      at('A cotação muda')
    ]
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    // The narrative is paragraphs, the method closes the same card.
    const card = page.querySelector('.ds-leitura-texto') as HTMLElement
    expect(card.querySelectorAll('.ds-narrativa p')).toHaveLength(2)
    expect(card.lastElementChild?.textContent).toBe('Como foi feito. Método de likert.')
    // Each ranked Dor: position, title, volume, trend, screen and impact.
    const [primeira, segunda] = Array.from(page.querySelectorAll<HTMLElement>('.ds-rank-linha'))
    expect(primeira.querySelector('.ds-rank-num')?.textContent).toBe('1')
    expect(
      Array.from(primeira.querySelectorAll('.ds-rank-meta span')).map((s) => s.textContent)
    ).toEqual(['412 menções', '+22%', 'Tela Confirmar'])
    expect(primeira.querySelector('.ds-impacto')?.textContent).toBe('Alto')
    expect(primeira.getAttribute('aria-label')).toBe(
      '1. A cotação muda: 412 menções, +22%, Tela Confirmar, impacto alto'
    )
    expect(
      Array.from(segunda.querySelectorAll('.ds-rank-meta span')).map((s) => s.textContent)
    ).toEqual(['133 menções', 'estável'])
  })

  it('C25a: back goes to Relatórios', async () => {
    const navigate = vi.fn()
    stubBridge({ relatorios: [likert()] })
    renderModule({ pagina: 'relatorio', relatorio: CAMINHO }, navigate)
    fireEvent.click(await screen.findByRole('button', { name: 'Relatórios' }))
    expect(navigate).toHaveBeenCalledWith({ pagina: 'relatorios' })
  })

  it('C25c: each line of "Dores ranqueadas" opens that Dor’s folha', async () => {
    stubBridge({ relatorios: [likert()] })
    renderModule({ pagina: 'relatorio', relatorio: CAMINHO })
    for (const titulo of ['A cotação muda', 'Sem tela']) {
      fireEvent.click(await screen.findByRole('button', { name: new RegExp(`^\\d\\. ${titulo}:`) }))
      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByRole('heading', { level: 2 }).textContent).toBe(titulo)
      fireEvent.click(within(dialog).getByRole('button', { name: 'Fechar' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    }
  })

  it('C31: a Relatório whose file is gone shows "Relatório não encontrado" and "Ver Relatórios", which goes to Relatórios', async () => {
    const navigate = vi.fn()
    const bridge = stubBridge({ relatorios: [] })
    renderModule({ pagina: 'relatorio', relatorio: 'Câmbio/relatorios/likert/sumiu.md' }, navigate)
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Relatório não encontrado' })
    ).toBeTruthy()
    expect(bridge.relatorio).toHaveBeenCalledWith('Câmbio/relatorios/likert/sumiu.md')
    fireEvent.click(screen.getByRole('button', { name: 'Ver Relatórios' }))
    expect(navigate).toHaveBeenCalledWith({ pagina: 'relatorios' })
  })

  it('reads an older Relatório on demand, and shows it', async () => {
    const antigo = relatorio('Câmbio', 'voz', [{ titulo: 'Antiga' }], {
      caminho: 'Câmbio/relatorios/voz/2026-09-01-90d.md'
    })
    const bridge = stubBridge({
      relatorios: [],
      porCaminho: { 'Câmbio/relatorios/voz/2026-09-01-90d.md': antigo }
    })
    renderModule({ pagina: 'relatorio', relatorio: 'Câmbio/relatorios/voz/2026-09-01-90d.md' })
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Relatório de Voz do Cliente' })
    ).toBeTruthy()
    expect(await screen.findByText('Antiga')).toBeTruthy()
    expect(bridge.relatorio).toHaveBeenCalledTimes(1)
  })

  it('reads a failed read as not found', async () => {
    stubBridge({ relatorios: [] })
    window.hive.designStudio.relatorio = vi.fn(async () => {
      throw new Error('disco')
    })
    renderModule({ pagina: 'relatorio', relatorio: CAMINHO })
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Relatório não encontrado' })
    ).toBeTruthy()
  })
})
