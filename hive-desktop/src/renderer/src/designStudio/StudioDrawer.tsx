import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { t } from '../i18n'
import { IconButton } from '../ui/IconButton'
import { CloseIcon } from '../ui/icons'

/**
 * Design Studio (M18) — T4.8. Where a surface goes when it loses its column
 * (design.md §3.8).
 *
 * Anchored to the right edge of the stage, not modal: the point of the drawer
 * is to inspect the Tela that is still on screen, and a modal that covers the
 * Tela would defeat the surface it contains. Escape closes it, which is the one
 * key users try on anything that slid in from an edge.
 */

export interface StudioDrawerProps {
  title: string
  onClose: () => void
  children?: ReactNode
}

export function StudioDrawer({ title, onClose, children }: StudioDrawerProps): React.JSX.Element {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <aside className="wb-dstudio-drawer" aria-label={title}>
      <header className="wb-dstudio-drawer-head">
        <h2 className="wb-dstudio-pane-title">{title}</h2>
        <IconButton label={t('designStudio.closeDrawer')} onClick={onClose}>
          <CloseIcon size={14} />
        </IconButton>
      </header>
      {children}
    </aside>
  )
}
