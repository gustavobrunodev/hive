import { t } from '../i18n'
import { ChatBubbleIcon, HiveCellIcon, SlidersIcon } from '../ui/icons'
import type { ShortcutScope } from '../ui/ShortcutCustomizer'

interface ShortcutsScopeProps {
  counts: Record<ShortcutScope, number>
  onOpenShortcuts?: (scope: ShortcutScope) => void
}

/** One shortcut set's summary row — icon, set name, live count, all quiet. */
function ShortcutSetRow({
  icon,
  label,
  count
}: {
  icon: React.ReactNode
  label: string
  count: number
}): React.JSX.Element {
  return (
    <li className="wb-profile-shortcut-row">
      <span className="wb-profile-shortcut-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="wb-profile-shortcut-label">{label}</span>
      <span className="wb-profile-shortcut-count" data-empty={count === 0 || undefined}>
        {count === 0 ? t('profile.shortcutsEmpty') : t('profile.shortcutsCount', count)}
      </span>
    </li>
  )
}

/**
 * Atalhos — the two sets, as a summary you read rather than a control you
 * operate, and one button that opens the picker where they are actually
 * changed. One destination for both sets, because that is what the picker is.
 */
export function ShortcutsScope({
  counts,
  onOpenShortcuts
}: ShortcutsScopeProps): React.JSX.Element {
  return (
    <div className="wb-profile-section">
      <ul className="wb-profile-shortcut-sets">
        <ShortcutSetRow
          icon={<HiveCellIcon size={14} />}
          label={t('profile.shortcutsStartLabel')}
          count={counts.start}
        />
        <ShortcutSetRow
          icon={<ChatBubbleIcon size={14} />}
          label={t('profile.shortcutsDuringLabel')}
          count={counts.during}
        />
      </ul>
      {onOpenShortcuts && (
        <button
          type="button"
          className="wb-profile-shortcut-cta"
          onClick={() => onOpenShortcuts('start')}
        >
          <SlidersIcon size={15} />
          {t('profile.shortcutsCta')}
        </button>
      )}
    </div>
  )
}
