import type { ReactNode } from 'react'
import { t } from '../i18n'
import { SIDEBAR_REGION_ID, type SidebarTab, type SidebarView, type WorkView } from './sidebarNav'

/**
 * The sidebar's two navigation primitives: the tab switcher at the top, and the
 * rows that pick a view inside a tab.
 *
 * They are separate components because they answer different questions. The
 * tabs answer "which half of the app am I in" — conversation, or files. The
 * rows answer "which surface inside it". Drawing both as the same control (the
 * old activity bar's four peer icons) is precisely what made the answer to the
 * first question unavailable.
 */

export interface SidebarTabsProps {
  active: SidebarTab
  onSelect: (tab: SidebarTab) => void
  /** Trailing slot — the pane's layout affordances (grip menu), so the row does double duty. */
  trailing?: ReactNode
  /** Drag-source wiring from the workbench (the pane header is the drag surface). */
  dragProps?: React.HTMLAttributes<HTMLElement>
}

/**
 * `Chat` / `Arquivos`, as a real tablist.
 *
 * A segmented pair rather than two icons: these are the app's top-level
 * destinations and they are worth their words. Roving `tabindex` and
 * arrow-key movement come from the `tablist`/`tab` roles being used properly —
 * `aria-selected` on the active one, `tabindex="-1"` on the rest, so Tab lands
 * once in the group and ←/→ move within it.
 */
export function SidebarTabs({
  active,
  onSelect,
  trailing,
  dragProps
}: SidebarTabsProps): React.JSX.Element {
  const tabs: { id: SidebarTab; label: string }[] = [
    { id: 'chat', label: t('nav.tabChat') },
    { id: 'files', label: t('nav.tabFiles') }
  ]
  return (
    <div className="wb-sidebar-tabbar" {...dragProps}>
      <div
        className="wb-sidebar-tabs"
        role="tablist"
        aria-label={t('nav.tabsLabel')}
        data-tour="rail"
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`wb-sidebar-tab-${tab.id}`}
            className="wb-sidebar-tab"
            aria-selected={tab.id === active}
            aria-controls={SIDEBAR_REGION_ID}
            tabIndex={tab.id === active ? 0 : -1}
            data-active={tab.id === active || undefined}
            data-tour={tab.id === 'files' ? 'files' : undefined}
            onClick={() => onSelect(tab.id)}
            onKeyDown={(event) => {
              const destinations: Partial<Record<string, number>> = {
                ArrowRight: (index + 1) % tabs.length,
                ArrowLeft: (index - 1 + tabs.length) % tabs.length,
                Home: 0,
                End: tabs.length - 1
              }
              const destination = destinations[event.key]
              if (destination === undefined) return
              event.preventDefault()
              const next = tabs[destination]
              onSelect(next.id)
              document.getElementById(`wb-sidebar-tab-${next.id}`)?.focus()
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {/* `!= null`, not `!== undefined`: the workbench passes `null` for the
          move menu while the sidebar is the only pane on screen, and an empty
          actions box still claims its gap in the row. */}
      {trailing != null && <div className="wb-sidebar-tabbar-actions">{trailing}</div>}
    </div>
  )
}

export interface SidebarNavItemProps {
  /** The view this row shows. Omitted for rows that open a dialog instead (Estúdio de skills). */
  view?: SidebarView | WorkView
  /**
   * DOM id of the region this row discloses — the sidebar panel for the file
   * surfaces, the work pane for the chat tools, which is where "Revisão do
   * agente" and "Bases de conhecimento" open. A row that names no region is a
   * plain button (it opens a dialog).
   */
  controls?: string
  label: string
  icon: ReactNode
  /** This row's surface is on screen right now. */
  active?: boolean
  /** A pending count — rendered as a badge and folded into the accessible name. */
  count?: number
  /** An ambient "needs attention" dot; quieter than a count and stacks with one. */
  dot?: boolean
  /** Extra detail for the accessible name (what the badge means in words). */
  detail?: string | null
  /** True when activating the row would put its surface away again. */
  togglesOff?: boolean
  onSelect: () => void
  'aria-keyshortcuts'?: string
  'data-tour'?: string
}

/**
 * The row's accessible name.
 *
 * A row already on screen names the action it will actually perform ("Ocultar
 * Explorador de arquivos"), because a toggle whose name never changes teaches
 * nobody that it is a toggle. The badge folds in too — a count rendered only
 * as a coloured chip is a visual-only cue.
 */
function navItemName(label: string, togglesOff: boolean, detail: string | null): string {
  const base = togglesOff ? t('nav.hideView', label) : label
  return detail !== null && detail !== '' ? `${base} — ${detail}` : base
}

/**
 * The disclosure pair, for a row that owns a region.
 *
 * The row discloses a region rather than only selecting within one: pressing
 * the active one puts that surface away. `aria-controls` names what moves — the
 * sidebar panel for the file surfaces, the work pane for the chat tools — so
 * the state is a promise about something. A row that names no region opens a
 * dialog instead, and says nothing here.
 */
function disclosureProps(
  controls: string | undefined,
  active: boolean
): { 'aria-expanded': boolean; 'aria-controls': string } | Record<string, never> {
  return controls === undefined ? {} : { 'aria-expanded': active, 'aria-controls': controls }
}

/** One sidebar row: icon, label, optional badge. */
export function SidebarNavItem({
  view,
  controls = view === undefined ? undefined : SIDEBAR_REGION_ID,
  label,
  icon,
  active = false,
  count = 0,
  dot = false,
  detail = null,
  togglesOff = false,
  onSelect,
  ...extra
}: SidebarNavItemProps): React.JSX.Element {
  return (
    <button
      type="button"
      className="wb-nav-item"
      data-view={view}
      data-active={active || undefined}
      aria-current={active ? 'true' : undefined}
      {...disclosureProps(controls, active)}
      aria-label={navItemName(label, togglesOff, detail)}
      onClick={onSelect}
      {...extra}
    >
      <span className="wb-nav-item-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="wb-nav-item-label">{label}</span>
      {count > 0 && (
        <span className="wb-nav-item-badge" aria-hidden="true">
          {count > 99 ? '99+' : count}
        </span>
      )}
      {dot && <span className="wb-nav-item-dot" aria-hidden="true" />}
    </button>
  )
}

/** A quiet uppercase heading over a group of sidebar rows. */
export function SidebarGroupLabel({ children }: { children: ReactNode }): React.JSX.Element {
  return <h2 className="wb-sidebar-group-label">{children}</h2>
}
