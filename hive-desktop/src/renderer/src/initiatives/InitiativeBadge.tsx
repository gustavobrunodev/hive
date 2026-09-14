import { t } from '../i18n'
import { colorVar } from './initiativeChrome'
import type { InitiativeColor } from './initiatives'

export interface InitiativeBadgeProps {
  title: string
  color: InitiativeColor
  /** `"row"` for the dense pill on a conversation row; `"panel"` for the rail's own header. */
  variant?: 'row' | 'panel'
  className?: string
}

/**
 * The mark a conversation wears to say which demand it belongs to.
 *
 * The name is *in* the pill, not encoded by its hue: colour is the thing that
 * makes a set scannable, and it is never the thing that makes it readable. So
 * the hue groups the rows at a glance, the words say which group, and a reader
 * who cannot separate two of the hues loses nothing but the glance.
 */
export function InitiativeBadge({
  title,
  color,
  variant = 'row',
  className
}: InitiativeBadgeProps): React.JSX.Element {
  return (
    <span
      className={className === undefined ? 'wb-init-badge' : `wb-init-badge ${className}`}
      data-variant={variant}
      // The hue arrives as a custom property so one rule styles every badge —
      // the pill tint is mixed down from this same value, which is what keeps
      // the fill and the ink in step when a theme re-tunes its ramp.
      style={{ ['--init-hue' as string]: colorVar(color) }}
      title={t('initiatives.conversationBadgeAria', title)}
    >
      <span className="wb-init-badge-dot" aria-hidden="true" />
      <span className="wb-init-badge-text">{title}</span>
    </span>
  )
}
