import { useId, useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@hive/design-system'
import { roleMeta, t } from '../i18n'
import { roleIcon } from './roleVisuals'
import { ChevronUpIcon, GearIcon, InfoIcon, SignOutIcon, UserIcon } from './icons'
import { initialsOf } from './userIdentity'

export interface UserMenuProps {
  userName: string | null
  /** The role chosen at first access — shown as identity, never edited here. */
  role: string | null
  /** Opens the settings surface (Perfil): name, role, agents, shortcuts, connection, voice, terminal, MCP. */
  onOpenSettings: () => void
  /** Opens the app surface: installed version + updates. */
  onOpenApp: () => void
  /** Leaves the app. */
  onSignOut: () => void
  /** An update is waiting — an ambient dot that survives dismissing the toast. */
  updatePending?: boolean
}

/** Matches the settings identity's stable role-icon rendering. */
function roleIconEl(roleId: string): React.JSX.Element {
  const RoleGlyph = roleIcon(roleId)
  return <RoleGlyph size={13} />
}

/**
 * The avatar and its menu, bottom-left of the sidebar.
 *
 * ## Why it moved down here
 *
 * It used to live in the far top-right corner — the single point on screen
 * furthest from everything a user touches, chosen because that is where web apps
 * put account menus. This app is not a web app: its work is in the left column
 * and the composer, and the two things the avatar leads to (your settings, the
 * app's version) are the two things a desktop user reaches for *while* working.
 * Anchoring it to the foot of the sidebar also gives the column a bottom edge,
 * which a scrolling list otherwise has to invent.
 *
 * ## The menu is identity, then destinations, then the way out
 *
 * The header restates who you are — name and role — because an avatar is two
 * initials and a colour, and "am I in the right profile?" is the question the
 * click is usually asking. `Configurações` opens the settings sheet (whose index
 * now includes MCP); `Versão e atualizações` sits directly beneath it, carrying
 * the update dot; `Sair do Hive` is separated, because it is the only entry that
 * cannot be undone by clicking again.
 *
 * Radix supplies the rest of the contract the redesign asked for: Escape and an
 * outside click close it, selecting an item closes it, focus returns to the
 * trigger, and arrow keys walk the items.
 */
export function UserMenu({
  userName,
  role,
  onOpenSettings,
  onOpenApp,
  onSignOut,
  updatePending = false
}: UserMenuProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const updateDescriptionId = useId()
  const initials = initialsOf(userName)
  const meta = roleMeta(role ?? 'general')
  const name = userName?.trim() ?? ''

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="wb-usermenu-trigger"
          data-tour="profile"
          aria-label={name === '' ? t('userMenu.openLabel') : t('userMenu.openLabelNamed', name)}
          aria-describedby={updatePending ? updateDescriptionId : undefined}
          title={t('userMenu.openLabel')}
        >
          <span className="wb-usermenu-avatar" aria-hidden="true">
            {initials ?? <UserIcon size={15} />}
          </span>
          <span className="wb-usermenu-identity">
            <span className="wb-usermenu-name">{name === '' ? t('userMenu.noName') : name}</span>
            <span className="wb-usermenu-role">{meta.name}</span>
          </span>
          {updatePending && (
            <>
              <span className="wb-usermenu-dot" aria-hidden="true" />
              <span id={updateDescriptionId} className="wb-visually-hidden">
                {t('update.pendingDotAria')}
              </span>
            </>
          )}
          {/* Nothing else in this row says it is a control: a name over a role,
              on the app's own background, reads as a caption of who is signed
              in. The caret is what makes it look like the button it is — and it
              points up because that is where the menu opens. */}
          <ChevronUpIcon size={14} className="wb-usermenu-caret" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      {open && (
        <DropdownMenuContent align="start" side="top" sideOffset={8} className="wb-usermenu-menu">
          <div className="wb-usermenu-head">
            <span className="wb-usermenu-head-avatar" aria-hidden="true">
              {initials ?? <UserIcon size={20} />}
            </span>
            <span className="wb-usermenu-head-text">
              <span className="wb-usermenu-head-name">
                {name === '' ? t('userMenu.noName') : name}
              </span>
              <span className="wb-usermenu-head-role">
                <span aria-hidden="true">{roleIconEl(role ?? 'general')}</span>
                {meta.name}
              </span>
            </span>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onOpenSettings}>
            <span className="wb-menu-item-icon" aria-hidden="true">
              <GearIcon size={15} />
            </span>
            <span className="wb-menu-item-text">
              <span className="wb-menu-item-title">{t('userMenu.settings')}</span>
              <span className="wb-menu-item-sub">{t('userMenu.settingsHint')}</span>
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onOpenApp}>
            <span className="wb-menu-item-icon" aria-hidden="true">
              <InfoIcon size={15} />
            </span>
            <span className="wb-menu-item-text">
              <span className="wb-menu-item-title">{t('userMenu.app')}</span>
              <span className="wb-menu-item-sub">{t('userMenu.appHint')}</span>
            </span>
            {updatePending && (
              <span className="wb-usermenu-item-dot" aria-label={t('update.pendingDotAria')} />
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onSignOut}>
            <span className="wb-menu-item-icon" aria-hidden="true">
              <SignOutIcon size={15} />
            </span>
            <span className="wb-menu-item-text">
              <span className="wb-menu-item-title">{t('userMenu.signOut')}</span>
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      )}
    </DropdownMenu>
  )
}
