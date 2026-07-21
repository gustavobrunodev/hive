import type { ReactNode } from 'react'
import { Empty, Spinner } from '@hive/design-system'
import { t } from '../../i18n'
import { IconButton } from '../../ui/IconButton'
import { FitIcon, RefreshIcon, ZoomInIcon, ZoomOutIcon } from '../../ui/icons'
import { ZOOM_MAX, ZOOM_MIN, stepZoom } from './docViewerCore'

/**
 * Shared component chrome for the rich file viewers (loading / error states,
 * the sub-toolbar, and the zoom cluster). Non-component logic (the async-load
 * hook and zoom math) lives in `docViewerCore.ts`.
 */

/** Centered loading state for a viewer body (spinner + label). */
export function DocLoading({ label }: { label?: string }): React.JSX.Element {
  return (
    <div className="wb-pane-center">
      <Spinner label={label ?? t('explorer.viewer.loading')} />
    </div>
  )
}

/** Centered error state with a retry affordance. */
export function DocError({ onRetry }: { onRetry: () => void }): React.JSX.Element {
  return (
    <div className="wb-pane-center">
      <div className="wb-doc-error">
        <Empty
          title={t('explorer.viewer.errorTitle')}
          description={t('explorer.viewer.errorDescription')}
        />
        <button type="button" className="wb-btn wb-doc-retry" onClick={onRetry}>
          <RefreshIcon size={14} />
          {t('explorer.viewer.retry')}
        </button>
      </div>
    </div>
  )
}

/** The viewer sub-toolbar (below the file header): a left cluster + a right-aligned `end` cluster. */
export function DocToolbar({
  children,
  end
}: {
  children?: ReactNode
  end?: ReactNode
}): React.JSX.Element {
  return (
    <div className="wb-doc-toolbar">
      <div className="wb-doc-toolbar-main">{children}</div>
      {end && <div className="wb-doc-toolbar-end">{end}</div>}
    </div>
  )
}

/** Zoom cluster shared by the image and pdf viewers: −, live %, +, fit-to-view. */
export function ZoomControls({
  zoom,
  onZoom,
  onFit
}: {
  zoom: number
  onZoom: (next: number) => void
  onFit: () => void
}): React.JSX.Element {
  return (
    <div className="wb-doc-zoom" role="group" aria-label={t('explorer.viewer.zoomLabel', 100)}>
      <IconButton
        label={t('explorer.viewer.zoomOut')}
        onClick={() => onZoom(stepZoom(zoom, -1))}
        disabled={zoom <= ZOOM_MIN}
      >
        <ZoomOutIcon />
      </IconButton>
      <span className="wb-doc-zoom-value" aria-live="polite">
        {t('explorer.viewer.zoomLabel', Math.round(zoom * 100))}
      </span>
      <IconButton
        label={t('explorer.viewer.zoomIn')}
        onClick={() => onZoom(stepZoom(zoom, 1))}
        disabled={zoom >= ZOOM_MAX}
      >
        <ZoomInIcon />
      </IconButton>
      <IconButton label={t('explorer.viewer.fit')} onClick={onFit}>
        <FitIcon />
      </IconButton>
    </div>
  )
}
