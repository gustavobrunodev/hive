import { useId } from 'react'
import { relativeTimeLabel, t } from '../i18n'
import { ChatBubbleIcon } from '../ui/icons'
import { SidebarNavItem } from '../ui/SidebarNav'
import { sessionTitle } from '../chat/sessionMeta'
import { DorIcon, HomeIcon, RelatorioIcon } from './icons'
import { recentConversations } from './model'
import { isOpenConversation, navSection, type DesignRoute, type NavSection } from './routes'
import type { DesignStudioStore, ModuleConversation } from './useDesignStudio'

/** The three pages, in the prototype's order (Protótipos, between Início and Dores, waits for task B). */
const PAGES: ReadonlyArray<{ id: NavSection; label: () => string; icon: React.JSX.Element }> = [
  { id: 'inicio', label: () => t('designStudio.nav.home'), icon: <HomeIcon size={15} /> },
  { id: 'dores', label: () => t('designStudio.nav.dores'), icon: <DorIcon size={15} /> },
  {
    id: 'relatorios',
    label: () => t('designStudio.nav.relatorios'),
    icon: <RelatorioIcon size={15} />
  }
]

/**
 * P1 — the Design Studio's navigation: what the Chat & Cowork tab's body shows
 * while the module is in front (decision 1).
 *
 * The pages, then "Recentes", then the "Dados de exemplo" label at the foot of
 * the body. The rows are the sidebar's own (`SidebarNavItem`), so "where I am"
 * reads the same here as one block up, beside "Revisão do agente".
 */
export function DesignStudioNav({ store }: { store: DesignStudioStore }): React.JSX.Element {
  const current = navSection(store.route)
  const recentesId = useId()
  return (
    <nav className="ds-nav" aria-label={t('designStudio.nav.label')}>
      <div className="wb-sidebar-nav ds-nav-pages">
        {PAGES.map((page) => (
          <SidebarNavItem
            key={page.id}
            label={page.label()}
            icon={page.icon}
            active={current === page.id}
            onSelect={() => store.navigate({ pagina: page.id })}
          />
        ))}
      </div>
      <section className="ds-nav-recentes" aria-labelledby={recentesId}>
        <h2 id={recentesId} className="wb-sidebar-group-label ds-nav-heading">
          {t('designStudio.nav.recentes')}
        </h2>
        <RecentList store={store} />
      </section>
      <p className="ds-nav-sample">{t('designStudio.sampleData')}</p>
    </nav>
  )
}

/**
 * The list under "Recentes". Nothing at all until the listing lands: the read
 * is local and fast, and an empty state that flashes before the rows arrive
 * says "you have no conversations" to someone who has seven.
 */
function RecentList({ store }: { store: DesignStudioStore }): React.JSX.Element | null {
  if (store.conversations === null) return null
  const rows = recentConversations(store.conversations)
  if (rows.length === 0) {
    return <p className="ds-nav-empty">{t('designStudio.nav.recentesEmpty')}</p>
  }
  return (
    <ul className="ds-recentes">
      {rows.map((row) => (
        <li key={`${row.produto}/${row.id}`}>
          <RecentRow row={row} route={store.route} now={store.loadedAt} onOpen={store.navigate} />
        </li>
      ))}
    </ul>
  )
}

/** One recent conversation: its icon, its title, and "<Produto> · <quando>" in the Hive list's own words. */
function RecentRow({
  row,
  route,
  now,
  onOpen
}: {
  row: ModuleConversation
  route: DesignRoute
  now: number
  onOpen: (route: DesignRoute) => void
}): React.JSX.Element {
  const open = isOpenConversation(route, row.produto, row.id)
  return (
    <button
      type="button"
      className="ds-recente"
      aria-current={open ? 'true' : undefined}
      onClick={() => onOpen({ pagina: 'conversa', produto: row.produto, conversa: row.id })}
    >
      <span className="ds-recente-icon" aria-hidden="true">
        <ChatBubbleIcon size={14} />
      </span>
      <span className="ds-recente-text">
        <span className="ds-recente-title">{sessionTitle(row)}</span>
        <span className="ds-recente-meta">
          {t('designStudio.nav.recenteMeta', row.produto, relativeTimeLabel(row.updatedAt, now))}
        </span>
      </span>
    </button>
  )
}
