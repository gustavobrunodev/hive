// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, render, within } from '@testing-library/react'
import { DesignStudioShell } from './DesignStudioShell'
import { pontesDaConversa, pontesDoCampo } from './__tests__/fixtures'
import type { DesignStudioStore, ModuleConversation } from './useDesignStudio'
import type { DesignPage, DesignRoute } from './routes'

/**
 * The module's work area: one layer per page, each with its own header.
 *
 * The five pages that own a header (Início, Dores, Relatórios, Relatório and
 * Conversa) carry the "Dados de exemplo" seal in it while the sidebar — whose
 * navigation already says "Dados de exemplo" — is out of sight.
 */

const NOW = Date.UTC(2026, 9, 4, 15, 0, 0)

beforeEach(() => {
  // The module's data never arrives here: every page stays in the frame it
  // draws while loading — the frame these cases are about.
  vi.stubGlobal('hive', {
    // The chat field's own bridges (task 1): dictation, the agent picker.
    ...pontesDoCampo(),
    designStudio: {
      dados: vi.fn(() => new Promise(() => {})),
      relatorio: vi.fn(() => new Promise(() => {})),
      geracaoAtual: vi.fn(async () => null),
      onGeracao: vi.fn(() => () => {}),
      ...pontesDaConversa().metodos
    }
  })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const CONVERSATION: ModuleConversation = {
  id: 'c1',
  produto: 'Pix',
  title: 'Compare as três Fontes',
  createdAt: NOW - 120_000,
  updatedAt: NOW - 60_000,
  messageCount: 2,
  agent: 'devin',
  preview: 'trecho',
  initiativePath: null
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
    conversations: [CONVERSATION],
    loadedAt: NOW,
    recarregar: vi.fn(),
    ...overrides
  }
}

function renderShell(
  store: DesignStudioStore,
  options: { navVisible?: boolean; userName?: string | null } = {}
): void {
  render(
    createElement(DesignStudioShell, {
      store,
      navVisible: options.navVisible ?? false,
      userName: options.userName === undefined ? 'Marina' : options.userName
    })
  )
}

/** The page layer on screen. */
function activePage(): HTMLElement {
  const page = document.querySelector<HTMLElement>('[data-page][data-active]')
  if (!page) throw new Error('no active page layer')
  return page
}

function header(page: HTMLElement = activePage()): HTMLElement {
  const element = page.querySelector('header')
  if (!element) throw new Error(`page ${page.dataset.page} has no header`)
  return element
}

const PAGES: Array<[string, DesignRoute, string | RegExp]> = [
  [
    'Início',
    { pagina: 'inicio' },
    /^(Bom dia|Boa tarde|Boa noite), Marina\. O que vamos melhorar hoje\?$/
  ],
  ['Dores', { pagina: 'dores' }, 'Dores'],
  ['Relatórios', { pagina: 'relatorios' }, 'Relatórios de Fonte'],
  [
    'Relatório',
    { pagina: 'relatorio', relatorio: 'Câmbio/relatorios/likert/2026-10-04-90d.md' },
    'Relatório de Likert'
  ],
  ['Conversa', { pagina: 'conversa', produto: 'Pix', conversa: 'c1' }, 'Compare as três Fontes']
]

describe('DesignStudioShell', () => {
  it.each(PAGES)(
    'C6: %s shows the "Dados de exemplo" seal inside its own header with the sidebar hidden',
    (_name, route, title) => {
      renderShell(storeWith({ route, mountedPages: [route.pagina] }), { navVisible: false })
      const page = activePage()
      expect(page.dataset.page).toBe(route.pagina)
      const head = header(page)
      expect(within(head).getByRole('heading', { level: 1, name: title })).toBeTruthy()
      expect(within(head).getByText('Dados de exemplo')).toBeTruthy()
    }
  )

  it.each(PAGES)(
    '%s leaves the seal to the sidebar while the module navigation is on screen',
    (_name, route) => {
      renderShell(storeWith({ route, mountedPages: [route.pagina] }), { navVisible: true })
      expect(within(header()).queryByText('Dados de exemplo')).toBeNull()
    }
  )

  it('keeps every visited page mounted and shows only the current one', () => {
    // C4's mechanism: leaving a page must cost nothing — its scroll and its
    // field are still there on the way back, because the layer never left.
    const visited: DesignPage[] = ['inicio', 'dores', 'relatorios']
    renderShell(storeWith({ route: { pagina: 'dores' }, mountedPages: visited }))
    const layers = Array.from(document.querySelectorAll<HTMLElement>('[data-page]'))
    expect(layers.map((layer) => layer.dataset.page)).toEqual(visited)
    expect(
      layers.filter((layer) => layer.hasAttribute('data-active')).map((l) => l.dataset.page)
    ).toEqual(['dores'])
  })

  it('stacks the layers in the fixed page order, whatever order they were visited in', () => {
    renderShell(
      storeWith({ route: { pagina: 'inicio' }, mountedPages: ['relatorios', 'inicio', 'dores'] })
    )
    expect(
      Array.from(document.querySelectorAll<HTMLElement>('[data-page]')).map((l) => l.dataset.page)
    ).toEqual(['inicio', 'dores', 'relatorios'])
  })

  it('greets without a name when the profile has none (Unresolved 3)', () => {
    renderShell(storeWith(), { userName: null })
    expect(
      within(header()).getByRole('heading', {
        level: 1,
        name: /^(Bom dia|Boa tarde|Boa noite)\. O que vamos melhorar hoje\?$/
      })
    ).toBeTruthy()
  })

  it('greets by the hour the page was opened at', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 4, 18, 30))
    renderShell(storeWith())
    expect(within(header()).getByRole('heading', { level: 1 }).textContent).toBe(
      'Boa noite, Marina. O que vamos melhorar hoje?'
    )
  })

  it('puts the subtitle under the greeting, without promising a Prototype yet', () => {
    renderShell(storeWith())
    expect(
      within(header()).getByText('Converse com o agente e cite as Dores dos clientes.')
    ).toBeTruthy()
  })

  it.each([
    ['voz', 'Relatório de Voz do Cliente'],
    ['fullstory', 'Relatório de FullStory']
  ])('names the Relatório after the Fonte in its path (%s)', (fonte, title) => {
    const route: DesignRoute = {
      pagina: 'relatorio',
      relatorio: `Pix/relatorios/${fonte}/2026-10-04-90d.md`
    }
    renderShell(storeWith({ route, mountedPages: ['relatorio'] }))
    expect(within(header()).getByRole('heading', { level: 1, name: title })).toBeTruthy()
  })

  it('falls back to "Relatório" for a path outside the decision-3 shape', () => {
    const route: DesignRoute = { pagina: 'relatorio', relatorio: 'Pix/outra-coisa.md' }
    renderShell(storeWith({ route, mountedPages: ['relatorio'] }))
    expect(within(header()).getByRole('heading', { level: 1, name: 'Relatório' })).toBeTruthy()
  })

  it('titles a conversation the listing does not know yet as "Conversa"', () => {
    const route: DesignRoute = { pagina: 'conversa', produto: 'Pix', conversa: 'outra' }
    renderShell(storeWith({ route, mountedPages: ['conversa'], conversations: null }))
    expect(within(header()).getByRole('heading', { level: 1, name: 'Conversa' })).toBeTruthy()
  })

  it('titles an untitled conversation the way the Hive list does', () => {
    const route: DesignRoute = { pagina: 'conversa', produto: 'Pix', conversa: 'c1' }
    renderShell(
      storeWith({
        route,
        mountedPages: ['conversa'],
        conversations: [{ ...CONVERSATION, title: '' }]
      })
    )
    expect(
      within(header()).getByRole('heading', { level: 1, name: 'Conversa sem título' })
    ).toBeTruthy()
  })
})
