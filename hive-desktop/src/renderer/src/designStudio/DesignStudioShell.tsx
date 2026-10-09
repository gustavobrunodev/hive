import type { ReactNode } from 'react'
import type { ClaudeAuthSession } from '../claudeAuth/useClaudeAuth'
import { AvisosDoModulo } from './AvisosDoModulo'
import { FolhaDor } from './FolhaDor'
import { ModuleDataContext, useModuleData } from './moduleData'
import { DESIGN_PAGES, type DesignRoute } from './routes'
import type { DesignStudioStore, ModuleConversation } from './useDesignStudio'
import { ConversaPage } from './pages/ConversaPage'
import { DoresPage } from './pages/DoresPage'
import { InicioPage } from './pages/InicioPage'
import { RelatorioPage } from './pages/RelatorioPage'
import { RelatoriosPage } from './pages/RelatoriosPage'

export interface DesignStudioShellProps {
  store: DesignStudioStore
  /** The Hive profile's name, for the home's greeting. */
  userName: string | null
  /**
   * The module's navigation — which carries the "Dados de exemplo" label — is
   * on screen. While it is not, each page shows the seal in its own header.
   */
  navVisible: boolean
  /**
   * The Hive's Claude account (held by the workbench, which owns its one login
   * subscription): a conversation turn that failed for want of an account
   * offers the same repair as the Hive chat (Unresolved 2).
   */
  claudeAuth?: ClaudeAuthSession
}

/** The conversation a Conversa route names, out of the listing. */
function findConversation(
  store: DesignStudioStore,
  route: Extract<DesignRoute, { pagina: 'conversa' }>
): ModuleConversation | undefined {
  return store.conversations?.find(
    (row) => row.produto === route.produto && row.id === route.conversa
  )
}

/**
 * One page's body, for the route it was last shown with. The two pages about
 * one thing (a Relatório, a conversation) take what identifies it from that
 * route, which is why every mounted layer keeps its own.
 */
function pageBody(
  route: DesignRoute,
  store: DesignStudioStore,
  userName: string | null,
  seal: boolean,
  claudeAuth: ClaudeAuthSession | undefined
): ReactNode {
  switch (route.pagina) {
    case 'inicio':
      return <InicioPage userName={userName} seal={seal} navigate={store.navigate} />
    case 'dores':
      return <DoresPage seal={seal} navigate={store.navigate} />
    case 'relatorios':
      return <RelatoriosPage seal={seal} navigate={store.navigate} />
    case 'relatorio':
      return <RelatorioPage relatorio={route.relatorio} seal={seal} navigate={store.navigate} />
    case 'conversa':
      return (
        <ConversaPage
          produto={route.produto}
          conversa={route.conversa}
          conversation={findConversation(store, route)}
          seal={seal}
          navigate={store.navigate}
          claudeAuth={claudeAuth}
        />
      )
  }
}

/**
 * A layer's identity. A parameterised page is a different layer per Relatório
 * or conversation, so opening another one starts at its top instead of at the
 * previous one's scroll.
 */
function layerKey(route: DesignRoute): string {
  switch (route.pagina) {
    case 'relatorio':
      return `relatorio:${route.relatorio}`
    case 'conversa':
      return `conversa:${route.produto}/${route.conversa}`
    default:
      return route.pagina
  }
}

/**
 * The Design Studio's work area: one layer per page ever shown, stacked in the
 * fixed page order, only the current one visible.
 *
 * Each layer is its own scroller and none is ever unmounted (`.ds-page-layer`
 * hides by `visibility`, never `display`), so a page keeps its scroll and its
 * field while the person is on another page — or out of the module entirely,
 * since the module's own work layer is kept the same way one level up
 * (criterion 4).
 */
export function DesignStudioShell({
  store,
  userName,
  navVisible,
  claudeAuth
}: DesignStudioShellProps): React.JSX.Element {
  const seal = !navVisible
  const dados = useModuleData(store.recarregar)
  const layers = DESIGN_PAGES.filter((page) => store.mountedPages.includes(page))
    .map((page) => store.pageRoutes[page])
    .filter((route): route is DesignRoute => route !== undefined)
  return (
    <ModuleDataContext.Provider value={dados}>
      <div className="ds-shell">
        {layers.map((route) => (
          <div
            key={layerKey(route)}
            className="ds-page-layer"
            data-page={route.pagina}
            data-active={route.pagina === store.route.pagina || undefined}
          >
            {pageBody(route, store, userName, seal, claudeAuth)}
          </div>
        ))}
      </div>
      <FolhaDor route={store.route} navigate={store.navigate} />
      <AvisosDoModulo geracao={dados.geracao} />
    </ModuleDataContext.Provider>
  )
}
