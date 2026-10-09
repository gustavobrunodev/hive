// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { relativeTimeLabel } from '../i18n'
import { SidebarHost } from '../ui/SidebarHost'
import { ChatTabBody } from './ChatTabBody'
import { DesignStudioNav } from './DesignStudioNav'
import type { DesignStudioStore, ModuleConversation } from './useDesignStudio'
import type { DesignPage, DesignRoute } from './routes'

/**
 * P1 — the module's navigation: the body of the Chat & Cowork tab while the
 * Design Studio is in front (decision 1). Início, Dores, Relatórios, the
 * "Recentes" section and the "Dados de exemplo" label, in that order.
 */

const NOW = Date.UTC(2026, 9, 4, 15, 0, 0)
const MINUTE = 60_000

afterEach(() => {
  cleanup()
})

function conversation(
  id: string,
  produto: string,
  minutesAgo: number,
  title = `Conversa ${id}`
): ModuleConversation {
  const updatedAt = NOW - minutesAgo * MINUTE
  return {
    id,
    produto,
    title,
    createdAt: updatedAt - MINUTE,
    updatedAt,
    messageCount: 2,
    agent: 'claude-cli',
    preview: 'trecho',
    initiativePath: null
  }
}

/**
 * A store as the hook would hand it over. Every mounted page has the route it
 * was last shown with; the current page's is the current route.
 */
function storeWith(overrides: Partial<DesignStudioStore> = {}): DesignStudioStore {
  const route = overrides.route ?? { pagina: 'inicio' }
  const mountedPages = overrides.mountedPages ?? [route.pagina]
  const pageRoutes: Partial<Record<DesignPage, DesignRoute>> = {}
  for (const page of mountedPages) {
    pageRoutes[page] = page === route.pagina ? route : ({ pagina: page } as DesignRoute)
  }
  return {
    route,
    navigate: vi.fn(),
    mountedPages,
    pageRoutes,
    conversations: [],
    loadedAt: NOW,
    recarregar: vi.fn(),
    ...overrides
  }
}

function renderNav(store: DesignStudioStore): void {
  render(createElement(DesignStudioNav, { store }))
}

/** The "Recentes" list's rows, in DOM order. */
function recentRows(): HTMLElement[] {
  const section = screen.getByRole('region', { name: 'Recentes' })
  return within(section).queryAllByRole('button')
}

/** `a` comes before `b` in document order. */
function before(a: Node, b: Node): boolean {
  return (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
}

/** Nine conversations spread over the three Produtos, deliberately out of order. */
const NINE: ModuleConversation[] = [
  conversation('c1', 'Câmbio', 300),
  conversation('c2', 'Pix', 5),
  conversation('c3', 'Extrato', 90),
  conversation('c4', 'Câmbio', 2),
  conversation('c5', 'Pix', 4000),
  conversation('c6', 'Extrato', 30),
  conversation('c7', 'Câmbio', 60 * 30),
  conversation('c8', 'Pix', 600),
  conversation('c9', 'Extrato', 1)
]

describe('DesignStudioNav', () => {
  it('C2d: Início → Dores → Relatórios → "Recentes" → its list → "Dados de exemplo", above the profile footer', () => {
    // Rendered inside the real sidebar host and the real Chat-tab body swap,
    // the same arrangement the workbench mounts — the footer is the host's.
    render(
      createElement(SidebarHost, {
        activeView: 'chat',
        chat: createElement(ChatTabBody, {
          designActive: true,
          hive: createElement('div', null),
          design: createElement(DesignStudioNav, {
            store: storeWith({ conversations: [conversation('c1', 'Pix', 3, 'Compare as Fontes')] })
          })
        }),
        explorer: null,
        scm: null,
        foot: createElement('span', null, 'perfil')
      })
    )

    const inicio = screen.getByRole('button', { name: 'Início' })
    const dores = screen.getByRole('button', { name: 'Dores' })
    const relatorios = screen.getByRole('button', { name: 'Relatórios' })
    const heading = screen.getByRole('heading', { name: 'Recentes' })
    const list = within(screen.getByRole('region', { name: 'Recentes' })).getByRole('list')
    const sample = screen.getByText('Dados de exemplo')
    const footer = document.querySelector('.wb-sidebar-foot') as HTMLElement

    const sequence = [inicio, dores, relatorios, heading, list, sample, footer]
    for (let index = 1; index < sequence.length; index += 1) {
      expect(before(sequence[index - 1], sequence[index])).toBe(true)
    }
    expect(footer.textContent).toBe('perfil')
  })

  it('C9a: "Recentes" shows 7 of 9 conversations, most recently updated first', () => {
    renderNav(storeWith({ conversations: NINE }))
    const rows = recentRows()
    expect(rows).toHaveLength(7)
    expect(rows.map((row) => within(row).getByText(/^Conversa c\d$/).textContent)).toEqual([
      'Conversa c9',
      'Conversa c4',
      'Conversa c2',
      'Conversa c6',
      'Conversa c3',
      'Conversa c1',
      'Conversa c8'
    ])
  })

  it('C9b: each row has a conversation icon, its title and "<Produto> · <quando>"; the open one is marked', () => {
    const open: DesignRoute = { pagina: 'conversa', produto: 'Extrato', conversa: 'c6' }
    renderNav(storeWith({ conversations: NINE, route: open }))

    for (const row of recentRows()) {
      expect(row.querySelector('svg')).not.toBeNull()
    }
    const byTitle = (title: string): HTMLElement =>
      recentRows().find((row) => row.textContent?.includes(title)) as HTMLElement

    const c6 = byTitle('Conversa c6')
    expect(within(c6).getByText('Conversa c6')).toBeTruthy()
    // `<quando>` is the Hive conversation list's own wording, from the same
    // function and the same render-stable "now" (the listing's load time).
    expect(
      within(c6).getByText(`Extrato · ${relativeTimeLabel(NOW - 30 * MINUTE, NOW)}`)
    ).toBeTruthy()
    expect(within(byTitle('Conversa c9')).getByText('Extrato · há 1 min')).toBeTruthy()
    expect(within(byTitle('Conversa c1')).getByText('Câmbio · há 5 h')).toBeTruthy()
    expect(within(byTitle('Conversa c8')).getByText('Pix · há 10 h')).toBeTruthy()

    expect(c6.getAttribute('aria-current')).toBe('true')
    for (const row of recentRows().filter((row) => row !== c6)) {
      expect(row.hasAttribute('aria-current')).toBe(false)
    }
  })

  it('C9b: the open conversation is identified by Produto and id together', () => {
    // Two Produtos can never share a session id in practice, but the key is
    // the pair — a row of another Produto with the same id is not "open".
    const twins = [
      conversation('same', 'Pix', 1, 'No Pix'),
      conversation('same', 'Câmbio', 2, 'No Câmbio')
    ]
    renderNav(
      storeWith({
        conversations: twins,
        route: { pagina: 'conversa', produto: 'Câmbio', conversa: 'same' }
      })
    )
    const [pix, cambio] = recentRows()
    expect(pix.hasAttribute('aria-current')).toBe(false)
    expect(cambio.getAttribute('aria-current')).toBe('true')
  })

  it('C9c: with no module conversation, "Recentes" says "Nenhuma conversa ainda"', () => {
    renderNav(storeWith({ conversations: [] }))
    const section = screen.getByRole('region', { name: 'Recentes' })
    expect(within(section).getByText('Nenhuma conversa ainda')).toBeTruthy()
    expect(within(section).queryAllByRole('button')).toHaveLength(0)
  })

  it('says nothing while the listing has not arrived — no "Nenhuma conversa ainda" flash', () => {
    renderNav(storeWith({ conversations: null }))
    const section = screen.getByRole('region', { name: 'Recentes' })
    expect(within(section).queryByText('Nenhuma conversa ainda')).toBeNull()
    expect(within(section).queryAllByRole('button')).toHaveLength(0)
  })

  it('opens a recent conversation on its own page', () => {
    const navigate = vi.fn()
    renderNav(storeWith({ conversations: NINE, navigate }))
    fireEvent.click(recentRows()[0])
    expect(navigate).toHaveBeenCalledWith({
      pagina: 'conversa',
      produto: 'Extrato',
      conversa: 'c9'
    })
  })

  it('names an untitled conversation the way the Hive list does', () => {
    renderNav(storeWith({ conversations: [conversation('c1', 'Pix', 1, '')] }))
    expect(within(recentRows()[0]).getByText('Conversa sem título')).toBeTruthy()
  })

  it('goes to each page, and marks the one on screen', () => {
    const navigate = vi.fn()
    renderNav(storeWith({ navigate, route: { pagina: 'dores' } }))

    fireEvent.click(screen.getByRole('button', { name: 'Início' }))
    expect(navigate).toHaveBeenLastCalledWith({ pagina: 'inicio' })
    fireEvent.click(screen.getByRole('button', { name: 'Relatórios' }))
    expect(navigate).toHaveBeenLastCalledWith({ pagina: 'relatorios' })
    fireEvent.click(screen.getByRole('button', { name: 'Dores' }))
    expect(navigate).toHaveBeenLastCalledWith({ pagina: 'dores' })

    expect(screen.getByRole('button', { name: 'Dores' }).getAttribute('aria-current')).toBe('true')
    expect(screen.getByRole('button', { name: 'Início' }).hasAttribute('aria-current')).toBe(false)
  })

  it('keeps "Relatórios" marked while one Relatório is open', () => {
    renderNav(
      storeWith({
        route: { pagina: 'relatorio', relatorio: 'Pix/relatorios/voz/2026-10-04-90d.md' }
      })
    )
    expect(screen.getByRole('button', { name: 'Relatórios' }).getAttribute('aria-current')).toBe(
      'true'
    )
  })

  it('marks no page while a conversation is open — the conversation row carries the mark', () => {
    renderNav(
      storeWith({
        conversations: NINE,
        route: { pagina: 'conversa', produto: 'Pix', conversa: 'c2' }
      })
    )
    for (const name of ['Início', 'Dores', 'Relatórios']) {
      expect(screen.getByRole('button', { name }).hasAttribute('aria-current')).toBe(false)
    }
  })

  it('is a navigation landmark named after the module', () => {
    renderNav(storeWith())
    expect(screen.getByRole('navigation', { name: 'Navegação do Design Studio' })).toBeTruthy()
  })
})
