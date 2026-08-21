import { HiveCellIcon, MicIcon, SparkleIcon, TerminalIcon, UserIcon } from '../ui/icons'
import type { ProfileScope } from './scopes'

type IconComponent = typeof UserIcon

/**
 * The glyph for each profile scope.
 *
 * One shape per scope, all rendered in the same accent-on-tint tile: the
 * product register bans heavy colour on inactive states, so the row's identity
 * is carried by the glyph rather than by five different hues (the macOS
 * Settings idiom, which would read as decoration here).
 */
const SCOPE_ICONS: Record<ProfileScope, IconComponent> = {
  account: UserIcon,
  agents: SparkleIcon,
  shortcuts: HiveCellIcon,
  voice: MicIcon,
  shell: TerminalIcon
}

export function scopeIcon(scope: ProfileScope): IconComponent {
  return SCOPE_ICONS[scope]
}
