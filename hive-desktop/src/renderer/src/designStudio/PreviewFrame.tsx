import { useEffect, useRef, useState } from 'react'
import { t } from '../i18n'
import type { PreviewDocument } from '../../../preview/messages'
import { createPreviewBridge, nonceFromUrl, type PreviewBridge } from './previewBridge'
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
  /** The Tela to draw. Absent until a Screen is active. */
  document?: PreviewDocument
  /** The outlined Component, mirrored from the Árvore (DS-R5 AC-5). */
  selectedComponentId?: string | null
  /** A Component was clicked on the stage — the other direction of the same selection. */
  onSelectComponent?: (componentId: string | null) => void
  /**
   * T6.6: the nodes a chat turn just changed. A new array identity is what
   * makes the outline fire, so the same turn never pulses twice.
   */
  pulse?: readonly string[]
}

export function PreviewFrame({
  size,
  document,
  selectedComponentId = null,
  onSelectComponent,
  pulse
}: PreviewFrameProps): React.JSX.Element {
  const [url, setUrl] = useState<string | null>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)
  // The bridge is state, not a ref, so the two effects that feed it re-run the
  // moment it exists. The session URL arrives asynchronously, so the document
  // and the selection are almost always already here by then — a ref would
  // have them waiting for the *next* change instead of the first paint.
  const [bridge, setBridge] = useState<PreviewBridge | null>(null)
  // Held in a ref so a new callback identity never tears the channel down and
  // loses the frame's handshake with it.
  const onSelectRef = useRef(onSelectComponent)
  useEffect(() => {
    onSelectRef.current = onSelectComponent
  })

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

  // One bridge per session URL: the nonce is the URL's, so a new session means
  // a new channel, and the old one must stop listening before it does.
  useEffect(() => {
    const frame = frameRef.current
    const nonce = url === null ? null : nonceFromUrl(url)
    if (frame === null || nonce === null) return
    const created = createPreviewBridge({
      frame,
      nonce,
      onSelected: (componentId) => onSelectRef.current?.(componentId)
    })
    setBridge(created)
    return () => {
      setBridge(null)
      created.dispose()
    }
  }, [url])

  // The whole document goes over, and the receiver reconciles by node id
  // (D-DS-6): sending Commands would mean a second reducer inside the frame.
  useEffect(() => {
    if (document) bridge?.render(document)
  }, [bridge, document])

  useEffect(() => {
    bridge?.select(selectedComponentId)
  }, [bridge, selectedComponentId])

  useEffect(() => {
    if (pulse !== undefined) bridge?.pulse([...pulse])
  }, [bridge, pulse])

  return (
    <iframe
      ref={frameRef}
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
