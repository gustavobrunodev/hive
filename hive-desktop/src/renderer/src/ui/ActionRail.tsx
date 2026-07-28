import { t } from '../i18n'
import {
  BrainIcon,
  FolderIcon,
  GearIcon,
  PlugIcon,
  ReviewIcon,
  SearchIcon,
  SourceControlIcon,
  SparkleIcon
} from './icons'

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

/** The swappable left-sidebar views (git-management D-GIT-2; +review, M11; +brain, M12). */
export type SidebarView = 'explorer' | 'scm' | 'review' | 'brain'

/** Appends `— <detail>` to a rail entry's accessible name when a badge is showing (folds the count in for screen readers). Multiple details read as one list. */
function withDetail(base: string, ...details: Array<string | null>): string {
  const present = details.filter((detail): detail is string => detail !== null && detail !== '')
  return present.length > 0 ? `${base} — ${present.join(' · ')}` : base
}

/** One activity-bar view switcher (Explorer / Source Control / Revisão) with an optional count badge. Extracted so `ActionRail` stays within its complexity budget. */
function RailViewButton({
  view,
  active,
  label,
  icon,
  count = 0,
  dot = false,
  onSelect,
  ...extra
}: {
  view: SidebarView
  active: boolean
  label: string
  icon: React.ReactNode
  count?: number
  /** An ambient "needs attention" dot (Second Brain health-check, SB-R10.4) — quieter than a count, and stacks with one. */
  dot?: boolean
  onSelect: (view: SidebarView) => void
  'data-tour'?: string
  'aria-keyshortcuts'?: string
}): React.JSX.Element {
  return (
    <button
      type="button"
      className="wb-rail-view"
      data-active={active || undefined}
      aria-pressed={active}
      title={label}
      aria-label={label}
      onClick={() => onSelect(view)}
      {...extra}
    >
      {icon}
      {count > 0 && (
        <span className="wb-rail-badge" aria-hidden="true">
          {count > 99 ? '99+' : count}
        </span>
      )}
      {dot && <span className="wb-rail-attention-dot" aria-hidden="true" />}
    </button>
  )
}

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
  /** Agent Change Review (M11): pending review count — a badge on the Revisão entry (0 hides it). */
  reviewCount?: number
  /** Second Brain (M12, SB-R2.5): count of raw items staged for ingestion — a badge on the Second Brain entry (0 hides it). */
  rawPendingCount?: number
  /** Second Brain (SB-R10.4): the vault is due for a health-check — an ambient dot on the entry that survives dismissing the floating reminder. */
  healthDue?: boolean
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
  reviewCount = 0,
  rawPendingCount = 0,
  healthDue = false,
  onOpenSearch,
  onOpenStudio,
  onOpenMcp,
  onOpenAppSettings,
  updatePending = false
}: ActionRailProps): React.JSX.Element {
  // Accessible names fold any badge count into the label (a badge alone is a
  // visual-only cue): "Controle de versão — N alterações pendentes", etc.
  const appSettingsLabel = withDetail(
    t('actionRail.appSettingsLabel'),
    updatePending ? t('update.pendingDotAria') : null
  )
  const scmLabel = withDetail(
    t('actionRail.scmView'),
    changeCount > 0 ? t('actionRail.scmChangeCount', changeCount) : null
  )
  const reviewLabel = withDetail(
    t('review.railLabel'),
    reviewCount > 0 ? t('review.barPending', reviewCount) : null
  )
  const brainLabel = withDetail(
    t('secondBrain.railLabel'),
    rawPendingCount > 0 ? t('secondBrain.railPending', rawPendingCount) : null,
    healthDue ? t('secondBrain.railHealthDue') : null
  )

  return (
    <nav className="wb-actionrail" aria-label={t('actionRail.ariaLabel')} data-tour="rail">
      <RailViewButton
        view="explorer"
        active={activeView === 'explorer'}
        label={t('actionRail.explorerView')}
        icon={<FolderIcon size={18} />}
        onSelect={onSelectView}
      />
      <RailViewButton
        view="scm"
        active={activeView === 'scm'}
        label={scmLabel}
        icon={<SourceControlIcon size={18} />}
        count={changeCount}
        onSelect={onSelectView}
        data-tour="scm"
        aria-keyshortcuts="Control+Shift+G"
      />
      <RailViewButton
        view="review"
        active={activeView === 'review'}
        label={reviewLabel}
        icon={<ReviewIcon size={18} />}
        count={reviewCount}
        onSelect={onSelectView}
        data-tour="review"
      />
      <RailViewButton
        view="brain"
        active={activeView === 'brain'}
        label={brainLabel}
        icon={<BrainIcon size={18} />}
        count={rawPendingCount}
        dot={healthDue}
        onSelect={onSelectView}
        data-tour="brain"
        aria-keyshortcuts="Control+Shift+B"
      />

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
