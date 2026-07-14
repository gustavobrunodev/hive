import { roleActionLabel, t } from '../i18n'
import { actionIcon } from './roleVisuals'
import { GearIcon } from './icons'

/** Structural mirror of `main/roleCatalog.ts`'s `ResolvedRoleAction`. */
export interface RoleAction {
  key: string
  kind: 'workflow' | 'persona'
  command: { key: string; prompt?: string }
}

interface ActionRailProps {
  actions: RoleAction[]
  /** Launch an action (routes to the chat as a workflow turn). */
  onLaunch: (action: RoleAction) => void
  /** Open the profile/settings sheet. */
  onOpenSettings: () => void
}

/**
 * The persistent left action rail (role-personalization RP-R5): the "second
 * home" for the role's actions, available at any time — not just on an empty
 * conversation. A fixed, quiet chrome column OUTSIDE the resizable body group
 * (so it never disturbs the persisted `hive.workLayout`). Icon-only, resting in
 * `--muted`, accent only on hover/active/persona — an always-there tool that
 * recedes until used. The persona action ("Conversar com <especialista>") sits
 * apart, above a hairline; the profile gear is bottom-anchored.
 */
export function ActionRail({
  actions,
  onLaunch,
  onOpenSettings
}: ActionRailProps): React.JSX.Element {
  const workflows = actions.filter((action) => action.kind === 'workflow')
  const personas = actions.filter((action) => action.kind === 'persona')

  function renderButton(action: RoleAction): React.JSX.Element {
    const Icon = actionIcon(action.key)
    const label = roleActionLabel(action.key)
    return (
      <button
        key={action.key}
        type="button"
        className="wb-rail-btn"
        data-persona={action.kind === 'persona' || undefined}
        title={label}
        aria-label={label}
        onClick={() => onLaunch(action)}
      >
        <Icon size={18} />
      </button>
    )
  }

  return (
    <nav className="wb-actionrail" aria-label={t('actionRail.ariaLabel')}>
      <div className="wb-actionrail-actions">
        {workflows.map(renderButton)}
        {personas.length > 0 && (
          <>
            <span className="wb-actionrail-divider" aria-hidden="true" />
            {personas.map(renderButton)}
          </>
        )}
      </div>
      <button
        type="button"
        className="wb-rail-btn wb-actionrail-settings"
        title={t('actionRail.settingsLabel')}
        aria-label={t('actionRail.settingsLabel')}
        onClick={onOpenSettings}
      >
        <GearIcon size={18} />
      </button>
    </nav>
  )
}
