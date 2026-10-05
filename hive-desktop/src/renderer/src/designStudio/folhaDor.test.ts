// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { relatorio, renderModule, storeAt, stubBridge } from './__tests__/fixtures'
import { DesignStudioShell } from './DesignStudioShell'
import { FolhaDor } from './FolhaDor'
import { ModuleDataContext, type ModuleData } from './moduleData'

/**
 * P9 — the folha da Dor (criteria 21–22): a modal dialog with the Dor, its
 * Fonte's three facts, the Evidências in the Fonte's shape and the Dores on
 * the same screen, opened from a note.
 */

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const RELATORIOS = [
  relatorio('Câmbio', 'likert', [
    {
      titulo: 'A cotação muda entre simular e confirmar',
      tela: 'Confirmar',
      impacto: 'alto',
      volume: 412,
      tendencia: 22
    },
    { titulo: 'As taxas aparecem só no final', tela: 'Revisar' }
  ]),
  relatorio('Câmbio', 'voz', [
    {
      titulo: 'Minha transação estornou sem aviso',
      tela: 'Acompanhar',
      impacto: 'alto',
      volume: 1284,
      tendencia: 31
    },
    { titulo: 'O chat não resolve', tela: undefined, impacto: 'baixo' }
  ]),
  relatorio('Câmbio', 'fullstory', [
    {
      titulo: 'Rage click no botão Confirmar remessa',
      tela: 'Confirmar',
      impacto: 'medio',
      volume: 2140,
      tendencia: -4
    }
  ])
]

async function openDores(navigate = vi.fn()): Promise<void> {
  stubBridge({ relatorios: RELATORIOS })
  renderModule({ pagina: 'dores' }, navigate)
  await screen.findByRole('heading', { level: 1, name: 'Dores de Câmbio' })
}

function note(titulo: string): HTMLElement {
  const el = Array.from(document.querySelectorAll<HTMLElement>('.hds-note')).find(
    (n) => n.querySelector('.hds-note-title')?.textContent === titulo
  )
  if (!el) throw new Error(`no note "${titulo}"`)
  return el
}

async function openFolha(titulo: string): Promise<HTMLElement> {
  fireEvent.click(note(titulo))
  return screen.findByRole('dialog')
}

describe('the folha da Dor', () => {
  it.each([
    ['clique', (el: HTMLElement) => fireEvent.click(el)],
    [
      'Enter',
      (el: HTMLElement) => {
        // A native button: the browser turns Enter into its click (C7a proves it live).
        expect(el.tagName).toBe('BUTTON')
        expect(el.getAttribute('type')).toBe('button')
        el.focus()
        fireEvent.keyDown(el, { key: 'Enter' })
        fireEvent.click(el)
      }
    ],
    [
      'Espaço',
      (el: HTMLElement) => {
        expect(el.tagName).toBe('BUTTON')
        el.focus()
        fireEvent.keyUp(el, { key: ' ' })
        fireEvent.click(el)
      }
    ]
  ])('C21a: opening a note by %s opens the folha as a modal dialog', async (_how, activate) => {
    await openDores()
    expect(screen.queryByRole('dialog')).toBeNull()
    activate(note('A cotação muda entre simular e confirmar'))
    const dialog = await screen.findByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(
      within(dialog).getByRole('heading', { name: 'A cotação muda entre simular e confirmar' })
    ).toBeTruthy()
  })

  it('C21b: shows the title, "<Fonte> · <n>ª em <Produto>", "Tela <Tela>" and the impact', async () => {
    await openDores()
    const dialog = await openFolha('Minha transação estornou sem aviso')
    expect(within(dialog).getByText('Voz do Cliente · 1ª em Câmbio')).toBeTruthy()
    expect(within(dialog).getByText('Tela Acompanhar')).toBeTruthy()
    expect(within(dialog).getByText('Impacto alto')).toBeTruthy()
    expect(within(dialog).getByRole('heading', { level: 3, name: /^Na mesma tela/ })).toBeTruthy()
  })

  it('C21b: a Dor with no screen leaves out "Tela" and "Na mesma tela" (Unresolved 8)', async () => {
    await openDores()
    const dialog = await openFolha('O chat não resolve')
    expect(within(dialog).getByText('Voz do Cliente · 2ª em Câmbio')).toBeTruthy()
    expect(within(dialog).queryByText(/^Tela /)).toBeNull()
    expect(within(dialog).queryByRole('heading', { name: /^Na mesma tela/ })).toBeNull()
    expect(within(dialog).getByText('Impacto baixo')).toBeTruthy()
  })

  it.each([
    [
      'Likert',
      'A cotação muda entre simular e confirmar',
      [
        ['412', 'menções'],
        ['+22%', 'em 90 dias'],
        ['6.912', 'respostas lidas']
      ]
    ],
    [
      'Voz do Cliente',
      'Minha transação estornou sem aviso',
      [
        ['1.284', 'ligações'],
        ['38%', 'ligam de novo'],
        ['+31%', 'em 90 dias']
      ]
    ],
    [
      'FullStory',
      'Rage click no botão Confirmar remessa',
      [
        ['2.140', 'clientes afetados'],
        ['Rage click', 'sinal'],
        ['−4%', 'em 90 dias']
      ]
    ]
  ])('C21c: the three facts of %s', async (_fonte, titulo, fatos) => {
    await openDores()
    const dialog = await openFolha(titulo)
    const lidos = Array.from(dialog.querySelectorAll('.ds-fato')).map((fato) => [
      fato.querySelector('dd')?.textContent,
      fato.querySelector('dt')?.textContent
    ])
    expect(lidos).toEqual(fatos)
  })

  it('C21d: shows the summary and "Evidências · <k> de <volume>, escolhidas pelo Relatório"', async () => {
    await openDores()
    const dialog = await openFolha('A cotação muda entre simular e confirmar')
    expect(within(dialog).getByText('Resumo da Dor 1 de likert.')).toBeTruthy()
    const heading = within(dialog).getByRole('heading', { level: 3, name: /^Evidências/ })
    expect(heading.textContent).toBe('Evidências · 1 de 412, escolhidas pelo Relatório')
  })

  it('C21d: a Likert Evidência shows its score of 1 to 5 and the comment', async () => {
    await openDores()
    const dialog = await openFolha('A cotação muda entre simular e confirmar')
    const evid = dialog.querySelector('.ds-evid') as HTMLElement
    expect(within(evid).getByRole('img', { name: 'Nota 2 de 5' })).toBeTruthy()
    expect(evid.querySelectorAll('.ds-escala i[data-on]')).toHaveLength(2)
    expect(evid.querySelectorAll('.ds-escala i')).toHaveLength(5)
    expect(evid.textContent).toContain(
      '“Preciso ver um lançamento de março e o app só mostra 90 dias.”'
    )
    expect(evid.textContent).toContain('LK-30512 · 25 set 2026 · App Android')
  })

  it('C21d: a Voz do Cliente Evidência shows the excerpts with time and speaker, and "Motivo registrado"', async () => {
    await openDores()
    const dialog = await openFolha('Minha transação estornou sem aviso')
    const evid = dialog.querySelector('.ds-evid') as HTMLElement
    const falas = Array.from(evid.querySelectorAll('.ds-fala')).map((fala) => [
      fala.querySelector('time')?.textContent,
      fala.querySelector('b')?.textContent,
      fala.querySelector('p')?.textContent
    ])
    expect(falas).toEqual([
      ['00:14', 'Cliente', 'O dinheiro voltou para a conta.'],
      ['01:05', 'Atendente', 'O banco recusou o IBAN.']
    ])
    expect(within(evid).getByText('Motivo registrado: Estorno de remessa')).toBeTruthy()
    expect(within(evid).getByText('Ligou de novo')).toBeTruthy()
    expect(evid.textContent).toContain('Ligação VC-55120 · 23 set 2026, 10:42 · 6 min 12 s')
  })

  it('C21d: a FullStory Evidência shows the signal, the element, the screen, the device and the moment', async () => {
    await openDores()
    const dialog = await openFolha('Rage click no botão Confirmar remessa')
    const evid = dialog.querySelector('.ds-evid') as HTMLElement
    expect(within(evid).getByText('Rage click em botão “Confirmar remessa”')).toBeTruthy()
    expect(within(evid).getByText('Android · app 8.42 · tela Confirmar · aos 00:47')).toBeTruthy()
    expect(within(evid).getByText('9 toques em 3 segundos no botão desabilitado.')).toBeTruthy()
    expect(evid.textContent).toContain('Sessão FS-88213 · 24 set 2026')
  })

  it('C21e: "Na mesma tela" lists the other visible Dores of that screen, each opening its own folha', async () => {
    await openDores()
    const dialog = await openFolha('A cotação muda entre simular e confirmar')
    const section = within(dialog).getByRole('region', { name: /^Na mesma tela/ })
    const items = within(section).getAllByRole('button')
    expect(items.map((item) => item.querySelector('.ds-relacionada-titulo')?.textContent)).toEqual([
      'Rage click no botão Confirmar remessa'
    ])
    fireEvent.click(items[0])
    await waitFor(() =>
      expect(
        within(screen.getByRole('dialog')).getByRole('heading', { level: 2 }).textContent
      ).toBe('Rage click no botão Confirmar remessa')
    )
  })

  it('C21e: a screen with no other visible Dor says "Nenhuma outra Dor nesta tela."', async () => {
    await openDores()
    const dialog = await openFolha('As taxas aparecem só no final')
    expect(within(dialog).getByText('Nenhuma outra Dor nesta tela.')).toBeTruthy()
  })

  it('closes on "Fechar"', async () => {
    await openDores()
    const dialog = await openFolha('As taxas aparecem só no final')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Fechar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('puts "Citar no chat" and "Perguntar ao agente" in its foot, outside the scroller', async () => {
    await openDores()
    const dialog = await openFolha('As taxas aparecem só no final')
    const pe = dialog.querySelector('.ds-folha-pe') as HTMLElement
    expect(within(pe).getByRole('button', { name: /Citar no chat/ })).toBeTruthy()
    expect(within(pe).getByRole('button', { name: /Perguntar ao agente/ })).toBeTruthy()
    expect(dialog.querySelector('.ds-folha-corpo')?.contains(pe)).toBe(false)
  })

  it('"Citar no chat" closes the folha and takes the person to the home, where the field holds the Dor', async () => {
    const navigate = vi.fn()
    await openDores(navigate)
    const dialog = await openFolha('As taxas aparecem só no final')
    fireEvent.click(within(dialog).getByRole('button', { name: /Citar no chat/ }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(navigate).toHaveBeenCalledWith({ pagina: 'inicio' })
  })

  it('"Perguntar ao agente" closes the folha and leaves the question for the home to send', async () => {
    const navigate = vi.fn()
    await openDores(navigate)
    const dialog = await openFolha('As taxas aparecem só no final')
    fireEvent.click(within(dialog).getByRole('button', { name: /Perguntar ao agente/ }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(navigate).toHaveBeenCalledWith({ pagina: 'inicio' })
  })

  it('opens a Dor of an older Relatório by reading that file, and says when it is still on its way', async () => {
    const antigo = relatorio(
      'Câmbio',
      'likert',
      [{ titulo: 'Dor de um Relatório antigo', tela: 'Simular' }],
      {
        caminho: 'Câmbio/relatorios/likert/2026-09-01-90d.md'
      }
    )
    const bridge = stubBridge({ relatorios: [antigo], porCaminho: {} })
    renderModule({ pagina: 'relatorio', relatorio: 'Câmbio/relatorios/likert/2026-09-01-90d.md' })
    const linha = await screen.findByRole('button', { name: /^1\. Dor de um Relatório antigo/ })
    fireEvent.click(linha)
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { level: 2 }).textContent).toBe(
      'Dor de um Relatório antigo'
    )
    expect(bridge.relatorio).not.toHaveBeenCalled()
  })
})

describe('the folha’s edges', () => {
  it('says "Citar nesta conversa" with a conversation open, and cites into it without leaving it', async () => {
    const navigate = vi.fn()
    stubBridge({ relatorios: RELATORIOS })
    // The Dores layer is mounted (hidden) under an open conversation.
    render(
      createElement(DesignStudioShell, {
        store: {
          ...storeAt({ pagina: 'conversa', produto: 'Câmbio', conversa: 'c1' }, navigate),
          mountedPages: ['dores', 'conversa'],
          pageRoutes: {
            dores: { pagina: 'dores' },
            conversa: { pagina: 'conversa', produto: 'Câmbio', conversa: 'c1' }
          }
        },
        userName: 'Marina',
        navVisible: false
      })
    )
    await screen.findByRole('heading', { level: 1, name: 'Dores de Câmbio' })
    fireEvent.click(note('As taxas aparecem só no final'))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: /Citar nesta conversa/ }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(navigate).not.toHaveBeenCalled()
  })

  it('shows its frame while the Dor’s Relatório is on its way, and reads it', async () => {
    const carregar = vi.fn()
    render(
      createElement(
        ModuleDataContext.Provider,
        {
          value: {
            relatorios: [],
            relatorioEm: () => undefined,
            carregar,
            folha: {
              aberta: { relatorio: 'Pix/relatorios/voz/x.md', dor: 'd' },
              origem: null,
              abrir: vi.fn(),
              fechar: vi.fn()
            }
          } as unknown as ModuleData
        },
        createElement(FolhaDor, { route: { pagina: 'inicio' }, navigate: vi.fn() })
      )
    )
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Abrindo a Dor…' })).toBeTruthy()
    expect(carregar).toHaveBeenCalledWith('Pix/relatorios/voz/x.md')
  })

  it('draws an Evidência with fields missing without inventing them', async () => {
    const r = relatorio('Pix', 'voz', [{ titulo: 'Voz sem detalhes', tela: 'Valor' }])
    r.dores[0].evidencias = [{ id: 'VC-1', rechamada: false }]
    const f = relatorio('Pix', 'fullstory', [{ titulo: 'Sessão sem detalhes', tela: 'Valor' }])
    f.dores[0].evidencias = [{ id: 'FS-1' }]
    const l = relatorio('Pix', 'likert', [{ titulo: 'Nota sem detalhes', tela: 'Valor' }])
    l.dores[0].evidencias = [{ id: 'LK-1' }]
    stubBridge({ relatorios: [r, f, l] })
    renderModule({ pagina: 'dores' })
    fireEvent.click(await screen.findByRole('radio', { name: 'Pix' }))
    for (const titulo of ['Voz sem detalhes', 'Sessão sem detalhes', 'Nota sem detalhes']) {
      fireEvent.click(await waitFor(() => note(titulo)))
      const dialog = await screen.findByRole('dialog')
      expect(dialog.querySelector('.ds-evid')).not.toBeNull()
      expect(dialog.textContent).not.toContain('undefined')
      fireEvent.click(within(dialog).getByRole('button', { name: 'Fechar' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    }
  })
})
