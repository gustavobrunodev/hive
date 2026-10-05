import type { ReactNode } from 'react'
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
  seal: boolean
): ReactNode {
  switch (route.pagina) {
    case 'inicio':
      return <InicioPage userName={userName} seal={seal} />
    case 'dores':
      return <DoresPage seal={seal} navigate={store.navigate} />
    case 'relatorios':
      return <RelatoriosPage seal={seal} navigate={store.navigate} />
    case 'relatorio':
      return <RelatorioPage relatorio={route.relatorio} seal={seal} navigate={store.navigate} />
    case 'conversa':
      return <ConversaPage conversation={findConversation(store, route)} seal={seal} />
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
  navVisible
}: DesignStudioShellProps): React.JSX.Element {
  const seal = !navVisible
  const dados = useModuleData()
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
            {pageBody(route, store, userName, seal)}
          </div>
        ))}
      </div>
      <FolhaDor route={store.route} navigate={store.navigate} />
      <AvisosDoModulo geracao={dados.geracao} />
    </ModuleDataContext.Provider>
  )
}
