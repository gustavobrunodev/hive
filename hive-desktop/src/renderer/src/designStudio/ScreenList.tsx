import { t } from '../i18n'
import { PencilIcon } from '../ui/icons'
import type { DetectedScreen } from './screens'
import type { ScreenSessions } from './screenSessions'
import { isEdited, sessionFor } from './screenSessions'

/**
 * Design Studio (M18) — T4.7. The Telas, and which of them the user has been
 * inside (DS-R4 AC-3).
 *
 * **The mark is never only a colour.** An auto-generated Tela shows a hollow
 * ring; one edited in this session shows a filled disc *and* a pencil. Shape
 * and icon each carry the whole distinction on their own, so the list still
 * reads under a forced palette, in greyscale, and for the ~8% of men who would
 * see the two dots as the same dot (DS-R18, PRODUCT.md's a11y floor). The
 * state is also written out for screen readers rather than left to the glyph.
 *
 * Rows are plain buttons rather than a listbox: Tab reaches each one and Enter
 * activates it with no custom key handling, which is the keyboard contract
 * with the fewest ways to be subtly wrong.
 */

export interface ScreenListProps {
  screens: DetectedScreen[]
  activeScreenId: string | null
  sessions: ScreenSessions
  onSelect: (screenId: string) => void
}

export function ScreenList({
  screens,
  activeScreenId,
  sessions,
  onSelect
}: ScreenListProps): React.JSX.Element {
  return (
    <ul className="wb-dstudio-screens" aria-label={t('designStudio.screenListAria')}>
      {screens.map((screen) => {
        const edited = isEdited(sessionFor(sessions, screen.screenId))
        return (
          <li key={screen.screenId}>
            <button
              type="button"
              className="wb-dstudio-screen-row"
              aria-current={screen.screenId === activeScreenId || undefined}
              onClick={() => onSelect(screen.screenId)}
            >
              <span
                className="wb-dstudio-screen-mark"
                data-edited={edited || undefined}
                aria-hidden="true"
              />
              <span className="wb-dstudio-screen-title">{screen.title}</span>
              {edited && <PencilIcon size={12} aria-hidden="true" />}
              <span className="wb-visually-hidden">
                {edited ? t('designStudio.screenEdited') : t('designStudio.screenAuto')}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
