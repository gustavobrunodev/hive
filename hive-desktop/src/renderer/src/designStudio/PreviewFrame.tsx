import { useEffect, useState } from 'react'
import { t } from '../i18n'
import type { ViewportSize } from './viewport'

/**
 * Design Studio (M18) — T4.6. The isolated Preview, at the device's real size.
 *
 * The `width`/`height` here are the *device's*, never the bench's: the whole
 * scaling rule (D-DS-7) exists so the document inside this frame sees 1440px
 * when the preset says Desktop. The reduction happens on an ancestor's
 * `transform`, which this component knows nothing about — and that ignorance is
 * the guarantee.
 *
 * Isolation is phase 3's (`sandbox="allow-scripts"` without `allow-same-origin`,
 * pointed by `src` at a `hive-studio:` URL whose per-session token is minted in
 * main). The session is opened on mount and retired on unmount, so a token that
 * outlived its tab resolves to a 404 rather than to a renderable frame.
 */

export interface PreviewFrameProps {
  /** The device size — the frame's own size, always (D-DS-7). */
  size: ViewportSize
}

export function PreviewFrame({ size }: PreviewFrameProps): React.JSX.Element {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let opened: string | null = null
    let cancelled = false
    void window.hive.designStudio
      .openPreview()
      .then((next) => {
        opened = next
        if (cancelled) {
          void window.hive.designStudio.closePreview(next)
          return
        }
        setUrl(next)
      })
      .catch(() => {
        // A Preview that could not be opened is handled by the stage's own
        // failure state (DS-R17); the frame just stays absent.
      })
    return () => {
      cancelled = true
      if (opened !== null) void window.hive.designStudio.closePreview(opened)
    }
  }, [])

  return (
    <iframe
      className="wb-dstudio-frame"
      title={t('designStudio.previewFrameTitle')}
      // Deliberately without `allow-same-origin`: the opaque origin it leaves
      // behind is what keeps the frame out of the app's own world (AD-5).
      sandbox="allow-scripts"
      src={url ?? undefined}
      width={size.width}
      height={size.height}
      style={{ width: `${size.width}px`, height: `${size.height}px` }}
    />
  )
}
