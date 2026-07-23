import { t } from '../i18n'
import { FolderIcon, GearIcon, PlugIcon, SearchIcon, SourceControlIcon, SparkleIcon } from './icons'

/** Structural mirror of `main/roleCatalog.ts`'s `ResolvedRoleAction`.
 *  `label` (shortcut-customization): catalog display name carried by
 *  custom-selected shortcuts — the pt-BR maps win when they know the key. */
export interface RoleAction {
  key: string
  kind: 'workflow' | 'persona'
  command: { key: string; prompt?: string }
  label?: string
  /** skill-studio: `true` on shortcuts backed by a user-created skill (spark icon). */
  custom?: boolean
}

/** The swappable left-sidebar views (git-management D-GIT-2). */
export type SidebarView = 'explorer' | 'scm'

interface ActionRailProps {
  /**
   * git-management (GIT-R13): the active sidebar view — Explorer or Source
   * Control. Optional-with-default so the rail keeps rendering until `WorkUI`
   * wires the switch (T15); defaults to `explorer`.
   */
  activeView?: SidebarView
  /** Selects a sidebar view (swaps the rail pane body). Defaults to a no-op until wired (T15). */
  onSelectView?: (view: SidebarView) => void
  /** Number of pending changes — a badge on the Source Control entry (0 hides it). */
  changeCount?: number
  /** Opens the workspace file-search palette (also reachable via Ctrl+P). */
  onOpenSearch: () => void
  /** Opens the Skill Studio (skill-studio): create skills/agents + evals. */
  onOpenStudio: () => void
  /** Opens the MCP module (mcp): manage Model Context Protocol servers. */
  onOpenMcp: () => void
  /** Opens the app settings sheet (version + updates). */
  onOpenAppSettings: () => void
  /**
   * npm-distribution T12 (design.md §5 Tier 1, ND-R5.5): true whenever an
   * update is pending — available, downloading, verifying, downloaded, or
   * error, i.e. anything that isn't "nothing going on". Paints a 6px accent
   * dot on the gear that **survives dismissal** of the Tier 2 notice
   * (`UpdateNotice`) — that's the "declining never strands you" guarantee —
   * and clears only when the version is skipped or successfully applied.
   * Defaults to `false` so every other caller (and every existing test)
   * keeps working unchanged.
   */
  updatePending?: boolean
}

/**
 * The persistent left activity bar — a fixed, quiet chrome column OUTSIDE the
 * resizable body group (so it never disturbs the persisted `hive.workLayout`).
 * Its top cluster are **view switchers** (git-management D-GIT-2, GIT-R13):
 * Explorer and Source Control toggle the rail pane's body one at a time,
 * exactly like VS Code's activity bar — the active entry carries a left
 * accent bar + filled state, and Source Control shows a change-count badge.
 * Below the divider sit the workspace tools (search, studio, MCP) and the
 * bottom-anchored app settings gear.
 */
export function ActionRail({
  activeView = 'explorer',
  onSelectView = () => {},
  changeCount = 0,
  onOpenSearch,
  onOpenStudio,
  onOpenMcp,
  onOpenAppSettings,
  updatePending = false
}: ActionRailProps): React.JSX.Element {
  // ND-R6.5: a dot alone is a color-only cue — the gear's accessible name
  // grows an addition (pt-BR.ts's `update.pendingDotAria`) whenever it's
  // showing, rather than relying on the dot's color/position alone.
  const appSettingsLabel = updatePending
    ? `${t('actionRail.appSettingsLabel')} — ${t('update.pendingDotAria')}`
    : t('actionRail.appSettingsLabel')

  // The SCM entry's accessible name folds in the change count (a badge alone
  // is a visual-only cue), so a screen reader hears "Controle de versão, N
  // alterações pendentes".
  const scmLabel =
    changeCount > 0
      ? `${t('actionRail.scmView')} — ${t('actionRail.scmChangeCount', changeCount)}`
      : t('actionRail.scmView')

  return (
    <nav className="wb-actionrail" aria-label={t('actionRail.ariaLabel')} data-tour="rail">
      <button
        type="button"
        className="wb-rail-view"
        data-active={activeView === 'explorer' || undefined}
        aria-pressed={activeView === 'explorer'}
        title={t('actionRail.explorerView')}
        aria-label={t('actionRail.explorerView')}
        onClick={() => onSelectView('explorer')}
      >
        <FolderIcon size={18} />
      </button>
      <button
        type="button"
        className="wb-rail-view"
        data-active={activeView === 'scm' || undefined}
        data-tour="scm"
        aria-pressed={activeView === 'scm'}
        title={scmLabel}
        aria-label={scmLabel}
        aria-keyshortcuts="Control+Shift+G"
        onClick={() => onSelectView('scm')}
      >
        <SourceControlIcon size={18} />
        {changeCount > 0 && (
          <span className="wb-rail-badge" aria-hidden="true">
            {changeCount > 99 ? '99+' : changeCount}
          </span>
        )}
      </button>

      <span className="wb-actionrail-divider" aria-hidden="true" />

      <button
        type="button"
        className="wb-rail-btn"
        title={`${t('actionRail.searchLabel')} (Ctrl+P)`}
        aria-label={t('actionRail.searchLabel')}
        aria-keyshortcuts="Control+P"
        onClick={onOpenSearch}
      >
        <SearchIcon size={18} />
      </button>
      <button
        type="button"
        className="wb-rail-btn"
        data-tour="studio"
        title={t('studio.openLabel')}
        aria-label={t('studio.openLabel')}
        onClick={onOpenStudio}
      >
        <SparkleIcon size={18} />
      </button>
      <button
        type="button"
        className="wb-rail-btn"
        data-tour="mcp"
        title={t('mcp.openLabel')}
        aria-label={t('mcp.openLabel')}
        onClick={onOpenMcp}
      >
        <PlugIcon size={18} />
      </button>
      <button
        type="button"
        className="wb-rail-btn wb-actionrail-settings"
        title={appSettingsLabel}
        aria-label={appSettingsLabel}
        onClick={onOpenAppSettings}
      >
        <GearIcon size={18} />
        {updatePending && <span className="wb-rail-update-dot" aria-hidden="true" />}
      </button>
    </nav>
  )
}
