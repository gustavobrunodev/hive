import { t } from '../i18n'
import { GearIcon, PlugIcon, SearchIcon, SparkleIcon } from './icons'

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

interface ActionRailProps {
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
 * The persistent left tool rail — a fixed, quiet chrome column OUTSIDE the
 * resizable body group (so it never disturbs the persisted `hive.workLayout`).
 * Workspace-scoped tools only: file search on top, app settings (version /
 * updates) bottom-anchored. The role shortcuts that used to live here moved
 * next to the conversation (Chat's shortcut strip + the hero pills) — closer
 * to where they're launched; the profile moved to the top bar's avatar.
 */
export function ActionRail({
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

  return (
    <nav className="wb-actionrail" aria-label={t('actionRail.ariaLabel')} data-tour="rail">
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
