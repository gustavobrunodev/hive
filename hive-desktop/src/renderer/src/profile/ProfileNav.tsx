import { t } from '../i18n'
import { ChevronRightIcon, CompassIcon, UserIcon } from '../ui/icons'
import { roleIcon } from '../ui/roleVisuals'
import { scopeIcon } from './scopeVisuals'
import { profileScopes, type ProfileScope } from './scopes'

interface ProfileNavProps {
  userName: string | null
  roleId: string
  roleName: string
  /** The right-hand summary per scope; `null` renders a skeleton (not yet known). */
  summaries: Record<ProfileScope, string | null>
  onOpen: (scope: ProfileScope) => void
  onReplayTour?: () => void
}

/** The user's initials, or `null` when there is no name to derive them from. */
function initialsOf(name: string | null): string | null {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return null
  const first = parts[0][0]
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase()
}

/** Renders a scope's icon element (a plain helper, not a per-render component alias — react-hooks/static-components). */
function iconEl(scope: ProfileScope): React.JSX.Element {
  const IconComponent = scopeIcon(scope)
  return <IconComponent size={15} />
}

/** Same, for the role glyph in the identity block. */
function roleIconEl(roleId: string): React.JSX.Element {
  const IconComponent = roleIcon(roleId)
  return <IconComponent size={13} />
}

/**
 * The profile index — who you are, then one row per scope.
 *
 * **The rows carry live values, which is the whole point.** A settings list
 * that only links to its pages makes the reader open all five to find out how
 * the app is set up; this one answers "which agent, how many shortcuts, which
 * model, which terminal" without a single click, and the drill-down is for
 * *changing* things rather than for discovering them.
 *
 * This replaced a single flat scroll: five sections stacked in a 900 px sheet
 * measured 1771 px, so more than half of the surface — the terminal picker, the
 * tour — existed below the fold with nothing on screen saying so.
 */
export function ProfileNav({
  userName,
  roleId,
  roleName,
  summaries,
  onOpen,
  onReplayTour
}: ProfileNavProps): React.JSX.Element {
  const initials = initialsOf(userName)
  return (
    <div className="wb-pnav">
      <div className="wb-pnav-identity">
        <span className="wb-pnav-avatar" aria-hidden="true">
          {initials ?? <UserIcon size={20} />}
        </span>
        <span className="wb-pnav-identity-text">
          <span className="wb-pnav-name">{userName?.trim() || t('profile.namePlaceholder')}</span>
          <span className="wb-pnav-role">
            <span className="wb-pnav-role-icon" aria-hidden="true">
              {roleIconEl(roleId)}
            </span>
            {roleName}
          </span>
        </span>
      </div>

      <ul className="wb-pnav-list" aria-label={t('profile.navLabel')}>
        {profileScopes().map((scope) => {
          const value = summaries[scope.id]
          return (
            <li key={scope.id}>
              <button
                type="button"
                className="wb-pnav-row"
                data-scope={scope.id}
                onClick={() => onOpen(scope.id)}
              >
                <span className="wb-pnav-icon" aria-hidden="true">
                  {iconEl(scope.id)}
                </span>
                <span className="wb-pnav-label">{scope.label}</span>
                {value === null ? (
                  <span className="wb-pnav-skeleton" aria-hidden="true" />
                ) : (
                  <span className="wb-pnav-value" title={value}>
                    {value}
                  </span>
                )}
                <span className="wb-pnav-chevron" aria-hidden="true">
                  <ChevronRightIcon size={15} />
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {onReplayTour && (
        <button type="button" className="wb-pnav-tour" onClick={onReplayTour}>
          <CompassIcon size={15} aria-hidden="true" />
          <span className="wb-pnav-tour-text">
            <span className="wb-pnav-tour-title">{t('profile.replayTourCta')}</span>
            <span className="wb-pnav-tour-hint">{t('profile.replayTourHint')}</span>
          </span>
        </button>
      )}

      <p className="wb-profile-scope-note">{t('profile.scopeNote')}</p>
    </div>
  )
}
