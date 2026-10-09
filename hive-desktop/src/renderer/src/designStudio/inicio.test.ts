// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import {
  activePage,
  camada,
  prepararDom,
  relatorio,
  renderModuloVivo,
  stubBridge
} from './__tests__/fixtures'

/**
 * P2 — the home of the module (criteria 1–3 of task 1, `home.js`): under the
 * greeting, the chat field, its hint, the Produto choice and "Dores em alta";
 * and, for a Produto with no Relatório, the way to its first one.
 */

beforeAll(prepararDom)

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const CAMBIO = [
  relatorio('Câmbio', 'likert', [
    { titulo: 'Alta com tendência 10', impacto: 'alto', tendencia: 10 },
    { titulo: 'Alta com tendência 30', impacto: 'alto', tendencia: 30 },
    { titulo: 'Média que cresce muito', impacto: 'medio', tendencia: 90 },
    { titulo: 'Alta com tendência 5', impacto: 'alto', tendencia: 5 }
  ]),
  relatorio('Câmbio', 'voz', [
    { titulo: 'Baixa da Voz', impacto: 'baixo', tendencia: 40 },
    { titulo: 'Média da Voz', impacto: 'medio', tendencia: 2 },
    { titulo: 'Outra média da Voz', impacto: 'medio', tendencia: 1 }
  ])
]

async function abrirInicio(relatorios = CAMBIO): Promise<ReturnType<typeof stubBridge>> {
  const bridge = stubBridge({ relatorios })
  renderModuloVivo()
  await screen.findByRole('heading', { level: 2, name: 'Dores em alta' })
  return bridge
}

function inicio(): HTMLElement {
  return camada('inicio')
}

function campo(): HTMLTextAreaElement {
  return within(inicio()).getByRole('textbox', {
    name: 'Mensagem para o agente'
  }) as HTMLTextAreaElement
}

function cluster(fonte: string): HTMLElement {
  return within(inicio()).getByRole('region', { name: fonte })
}

function notas(regiao: HTMLElement): string[] {
  return Array.from(regiao.querySelectorAll('.hds-note-title')).map((n) => n.textContent ?? '')
}

function nota(titulo: string): HTMLElement {
  const el = Array.from(inicio().querySelectorAll<HTMLElement>('.hds-note')).find(
    (n) => n.querySelector('.hds-note-title')?.textContent === titulo
  )
  if (!el) throw new Error(`no note "${titulo}"`)
  return el
}

/** True when `a` comes before `b` in document order. */
function antes(a: Node, b: Node): boolean {
  return (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
}

describe('the home of the module', () => {
  it('1-C1a: below the greeting come, in this order, the chat field, the hint, the Produto choice and "Dores em alta"', async () => {
    await abrirInicio()
    const saudacao = within(inicio()).getByRole('heading', { level: 1 })
    const dica = inicio().querySelector('.ds-dica') as HTMLElement
    const produto = within(inicio()).getByRole('radiogroup', { name: 'Produto' })
    const secao = within(inicio()).getByRole('region', { name: 'Dores em alta' })
    expect(antes(saudacao, campo())).toBe(true)
    expect(antes(campo(), dica)).toBe(true)
    expect(antes(dica, produto)).toBe(true)
    expect(antes(produto, secao)).toBe(true)
    expect(secao.contains(produto)).toBe(false)
  })

  it('1-C1c: the hint reads exactly "Enter envia · Shift+Enter quebra a linha · Ctrl+V cola prints · @ cita Dores", each key in a <kbd>', async () => {
    await abrirInicio()
    const dica = inicio().querySelector('.ds-dica') as HTMLElement
    expect(dica.textContent).toBe(
      'Enter envia · Shift+Enter quebra a linha · Ctrl+V cola prints · @ cita Dores'
    )
    expect(Array.from(dica.querySelectorAll('kbd')).map((k) => k.textContent)).toEqual([
      'Enter',
      'Shift',
      'Enter',
      'Ctrl',
      'V',
      '@'
    ])
  })

  it('1-C1d: the Produto choice offers exactly Câmbio, Extrato and Pix, in the catalog’s order', async () => {
    await abrirInicio()
    const produto = within(inicio()).getByRole('radiogroup', { name: 'Produto' })
    expect(
      within(produto)
        .getAllByRole('radio')
        .map((r) => r.textContent)
    ).toEqual(['Câmbio', 'Extrato', 'Pix'])
  })

  it('1-C2a: per Fonte with a Relatório, the 2 Dores of greatest impact — on a tie, of greatest trend', async () => {
    await abrirInicio()
    // Likert: the two "alto" with the greatest trend. The "alto" with a smaller
    // trend and the "médio" that grows the most are left out.
    expect(notas(cluster('Likert'))).toEqual(['Alta com tendência 30', 'Alta com tendência 10'])
    // Voz: the two "médio" over the "baixo", the greater trend first.
    expect(notas(cluster('Voz do Cliente'))).toEqual(['Média da Voz', 'Outra média da Voz'])
    expect(notas(cluster('FullStory'))).toEqual([])
  })

  it('1-C2b: touching a note puts its Dor’s chip in the field and presses it; touching again takes both back', async () => {
    await abrirInicio()
    const contexto = (): HTMLElement | null => inicio().querySelector('.ds-campo-contexto')
    expect(nota('Alta com tendência 30').getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(nota('Alta com tendência 30'))
    await waitFor(() =>
      expect(nota('Alta com tendência 30').getAttribute('aria-pressed')).toBe('true')
    )
    expect(within(contexto() as HTMLElement).getByText('Alta com tendência 30')).toBeTruthy()

    fireEvent.click(nota('Alta com tendência 30'))
    await waitFor(() =>
      expect(nota('Alta com tendência 30').getAttribute('aria-pressed')).toBe('false')
    )
    expect(contexto()).toBeNull()
  })

  it('1-C2c: "Ver todas" goes to the Dores page with the chosen Produto', async () => {
    await abrirInicio([
      ...CAMBIO,
      relatorio('Extrato', 'likert', [{ titulo: 'Histórico curto', impacto: 'alto' }])
    ])
    fireEvent.click(within(inicio()).getByRole('radio', { name: 'Extrato' }))
    await waitFor(() => expect(notas(cluster('Likert'))).toEqual(['Histórico curto']))
    fireEvent.click(within(cluster('Likert')).getByRole('button', { name: 'Ver todas' }))
    await waitFor(() => expect(activePage().dataset.page).toBe('dores'))
    expect(
      within(activePage()).getByRole('heading', { level: 1, name: 'Dores de Extrato' })
    ).toBeTruthy()
  })

  it('1-C2d: a Fonte with no Relatório shows "Ainda sem Relatório de <Fonte>" and "Gerar", which asks for that generation', async () => {
    const bridge = await abrirInicio()
    const fullstory = cluster('FullStory')
    expect(within(fullstory).getByText('Ainda sem Relatório de FullStory')).toBeTruthy()
    fireEvent.click(within(fullstory).getByRole('button', { name: 'Gerar' }))
    await waitFor(() =>
      expect(bridge.planejarGeracao).toHaveBeenCalledWith(
        expect.objectContaining({ produto: 'Câmbio', fonte: 'fullstory' })
      )
    )
  })

  it('1-C3a: a Produto with no Relatório says "<Produto> ainda não tem Relatórios de Fonte." with "Gerar o primeiro Relatório de <Produto>"', async () => {
    await abrirInicio()
    fireEvent.click(within(inicio()).getByRole('radio', { name: 'Pix' }))
    const secao = within(inicio()).getByRole('region', { name: 'Dores em alta' })
    expect(await within(secao).findByText('Pix ainda não tem Relatórios de Fonte.')).toBeTruthy()
    expect(
      within(secao).getByRole('button', { name: 'Gerar o primeiro Relatório de Pix' })
    ).toBeTruthy()
    expect(within(secao).queryByRole('region', { name: 'Likert' })).toBeNull()
  })

  it('1-CU3: neither the home nor the conversa do Produto shows an item marked "Próxima versão"', async () => {
    await abrirInicio()
    expect(document.body.textContent).not.toMatch(/Próxima versão/i)
    fireEvent.click(within(inicio()).getByRole('radio', { name: 'Pix' }))
    await within(inicio()).findByText('Pix ainda não tem Relatórios de Fonte.')
    expect(document.body.textContent).not.toMatch(/Próxima versão/i)
    // The conversation the home opens, guided first Relatório included.
    fireEvent.click(
      within(inicio()).getByRole('button', { name: 'Gerar o primeiro Relatório de Pix' })
    )
    await waitFor(() => expect(activePage().dataset.page).toBe('conversa'))
    await within(activePage()).findByText('Por qual Fonte quer começar?')
    expect(document.body.textContent).not.toMatch(/Próxima versão/i)
  })
})
