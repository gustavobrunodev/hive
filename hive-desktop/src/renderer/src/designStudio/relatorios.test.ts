// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { relatorio, renderModule, stubBridge } from './__tests__/fixtures'

/**
 * P10 — Relatórios de Fonte (criterion 24): one section per Produto, one row
 * per Fonte; a row with a Relatório opens it, one without asks for it.
 */

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

async function openRelatorios(
  relatorios = [
    relatorio('Câmbio', 'likert', [{}], {
      destaque: '28% das respostas com nota 1 ou 2',
      geradoEm: '2026-09-29T11:40:00.000Z'
    })
  ],
  navigate = vi.fn()
): Promise<void> {
  stubBridge({ relatorios })
  renderModule({ pagina: 'relatorios' }, navigate)
  await screen.findByRole('region', { name: /^Câmbio/ })
}

function section(produto: string): HTMLElement {
  return screen.getByRole('region', { name: new RegExp(`^${produto}`) })
}

function rows(produto: string): HTMLElement[] {
  return Array.from(section(produto).querySelectorAll<HTMLElement>('.ds-rel-linha'))
}

describe('Relatórios de Fonte', () => {
  it('C24a: every Produto (Câmbio, Extrato, Pix) has one row per Fonte, in the order Likert, Voz do Cliente, FullStory', async () => {
    await openRelatorios()
    const produtos = screen
      .getAllByRole('heading', { level: 2 })
      .map((h) => h.firstChild?.textContent)
    expect(produtos).toEqual(['Câmbio', 'Extrato', 'Pix'])
    for (const produto of ['Câmbio', 'Extrato', 'Pix']) {
      expect(rows(produto).map((row) => row.querySelector('.ds-rel-fonte b')?.textContent)).toEqual(
        ['Likert', 'Voz do Cliente', 'FullStory']
      )
    }
  })

  it('C24b: a row with a Relatório shows the Fonte, "<Produto> · <período>", the highlight, "<volume> <unidade> · gerado em <data>" and "Abrir", which goes to the Leitura', async () => {
    const navigate = vi.fn()
    await openRelatorios(undefined, navigate)
    const [likert] = rows('Câmbio')
    expect(likert.querySelector('.ds-rel-fonte')?.textContent).toBe(
      'LikertCâmbio · 7 jul a 4 out 2026'
    )
    const destaque = likert.querySelector('.ds-rel-destaque') as HTMLElement
    expect(destaque.firstChild?.textContent).toBe('28% das respostas com nota 1 ou 2')
    expect(destaque.querySelector('small')?.textContent).toMatch(
      /^6\.912 respostas · gerado em 29 set 2026, \d{2}:\d{2}$/
    )
    fireEvent.click(
      within(likert).getByRole('button', { name: 'Abrir o Relatório de Likert de Câmbio' })
    )
    expect(navigate).toHaveBeenCalledWith({
      pagina: 'relatorio',
      relatorio: 'Câmbio/relatorios/likert/2026-10-04-90d.md'
    })
    expect(within(likert).getByRole('button').textContent).toBe('Abrir')
  })

  it('C24c: a row with no Relatório shows "<Produto> · ainda não gerado", the Fonte’s description and "Gerar"', async () => {
    await openRelatorios()
    const [, voz] = rows('Câmbio')
    expect(voz.querySelector('.ds-rel-fonte small')?.textContent).toBe('Câmbio · ainda não gerado')
    expect(voz.querySelector('.ds-rel-destaque')?.textContent).toBe(
      'Ligações em que clientes relatam dores a atendentes'
    )
    const gerar = within(voz).getByRole('button', {
      name: 'Gerar o Relatório de Voz do Cliente de Câmbio'
    })
    expect(gerar.textContent).toBe('Gerar')
  })

  it('C24d: each Produto is a section headed "<Produto> · <descrição>" with a list of 3 rows: tile → Fonte and meta → highlight and meta → action', async () => {
    await openRelatorios()
    const cambio = section('Câmbio')
    expect(within(cambio).getByRole('heading', { level: 2 }).textContent).toBe(
      'Câmbio · Compra e envio de moeda estrangeira pelo app'
    )
    expect(within(cambio).getAllByRole('listitem')).toHaveLength(3)
    for (const row of rows('Câmbio')) {
      expect(Array.from(row.children).map((child) => child.className)).toEqual([
        'ds-fonte-tile',
        'ds-rel-fonte',
        expect.stringMatching(/^ds-rel-destaque/),
        'ds-rel-acao'
      ])
    }
  })
})
