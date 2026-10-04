/**
 * Where the person is inside the Design Studio.
 *
 * Five pages, each a layer of the module's work area. Two of them are about
 * one thing — a Relatório, a conversation — and carry what identifies it.
 */

/** The module's pages, in the order their layers are stacked. */
export type DesignPage = 'inicio' | 'dores' | 'relatorios' | 'relatorio' | 'conversa'

export type DesignRoute =
  | { pagina: 'inicio' }
  | { pagina: 'dores' }
  | { pagina: 'relatorios' }
  /** `relatorio` is the file's path relative to `<raiz>` — the same string a Dor citation carries (decision 4). */
  | { pagina: 'relatorio'; relatorio: string }
  /** A module conversation is a history session keyed by `<raiz>/<produto>`, so the pair identifies it. */
  | { pagina: 'conversa'; produto: string; conversa: string }

export const DESIGN_PAGES: readonly DesignPage[] = [
  'inicio',
  'dores',
  'relatorios',
  'relatorio',
  'conversa'
]

/** Where the module opens: on every first visit, and after every restart (criterion 5). */
export const HOME_ROUTE: DesignRoute = { pagina: 'inicio' }

/** The three pages the navigation lists. */
export type NavSection = 'inicio' | 'dores' | 'relatorios'

/**
 * Which navigation item is "where I am". A Relatório is read from Relatórios,
 * so that item stays marked while one is open; a conversation is marked by its
 * own row in Recentes, not by a page.
 */
export function navSection(route: DesignRoute): NavSection | null {
  switch (route.pagina) {
    case 'relatorio':
      return 'relatorios'
    case 'conversa':
      return null
    default:
      return route.pagina
  }
}

/** True when `route` is this conversation's page. */
export function isOpenConversation(route: DesignRoute, produto: string, conversa: string): boolean {
  return route.pagina === 'conversa' && route.produto === produto && route.conversa === conversa
}
