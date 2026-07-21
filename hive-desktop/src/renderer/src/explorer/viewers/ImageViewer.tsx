import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { t } from '../../i18n'
import { formatBytes } from '../richViewer'
import { DocError, DocLoading, DocToolbar, ZoomControls } from './docViewerShared'
import { clampZoom, useAsyncDocument } from './docViewerCore'

/**
 * Image viewer (png/jpg/gif/webp/avif/bmp/ico/svg). The bytes come over IPC as
 * base64 and render from a `data:` URL — allowed by the renderer's `img-src
 * 'self' data:` CSP with no temp files. Fit-to-view is the default; the image
 * sits on a checkerboard so transparency reads honestly. Zooming past the
 * frame turns the stage into a pannable surface (drag, or native scroll).
 */
export function ImageViewer({
  workspace,
  path
}: {
  workspace: string
  path: string
}): React.JSX.Element {
  const load = useCallback(() => window.hive.fs.readBinary(workspace, path), [workspace, path])
  const { status, data, reload } = useAsyncDocument(load, path)

  const stageRef = useRef<HTMLDivElement>(null)
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [stageSize, setStageSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 })
  // `null` zoom = fit-to-view (contain); a number = explicit scale of natural pixels.
  const [zoom, setZoom] = useState<number | null>(null)

  // Track the stage's own box so "fit" can be expressed as a real pixel scale
  // (which the toolbar shows as a %), and re-fit on pane resize.
  useLayoutEffect(() => {
    const el = stageRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect
      if (box) setStageSize({ w: box.width, h: box.height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [status])

  // A fresh file resets zoom back to fit (setState wrapped in a callback
  // invoked from the effect, per react-hooks/set-state-in-effect).
  useEffect(() => {
    const reset = (): void => {
      setZoom(null)
      setNatural(null)
    }
    reset()
  }, [path])

  const fitScale =
    natural && stageSize.w > 0 && natural.w > 0
      ? Math.min(stageSize.w / natural.w, stageSize.h / natural.h, 1)
      : 1
  const effectiveScale = zoom ?? fitScale

  const handleZoom = useCallback((next: number) => setZoom(clampZoom(next)), [])
  const handleFit = useCallback(() => setZoom(null), [])
  const toggleActual = useCallback(() => setZoom((current) => (current === null ? 1 : null)), [])

  // Drag-to-pan when the scaled image overflows the stage.
  const panRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null)
  const [panning, setPanning] = useState(false)
  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>): void => {
    const stage = stageRef.current
    if (!stage) return
    const overflowing =
      stage.scrollWidth > stage.clientWidth || stage.scrollHeight > stage.clientHeight
    if (!overflowing) return
    panRef.current = {
      x: event.clientX,
      y: event.clientY,
      left: stage.scrollLeft,
      top: stage.scrollTop
    }
    setPanning(true)
    stage.setPointerCapture(event.pointerId)
  }, [])
  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>): void => {
    const start = panRef.current
    const stage = stageRef.current
    if (!start || !stage) return
    stage.scrollLeft = start.left - (event.clientX - start.x)
    stage.scrollTop = start.top - (event.clientY - start.y)
  }, [])
  const endPan = useCallback((event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!panRef.current) return
    panRef.current = null
    setPanning(false)
    stageRef.current?.releasePointerCapture(event.pointerId)
  }, [])

  if (status === 'loading') return <DocLoading />
  if (status === 'error' || !data) return <DocError onRetry={reload} />

  const src = `data:${data.mime};base64,${data.base64}`
  // svg has no intrinsic raster size; keep it fit-driven so it can't blow up.
  const width = natural ? Math.round(natural.w * effectiveScale) : undefined

  return (
    <div className="wb-doc wb-image-viewer">
      <DocToolbar
        end={<ZoomControls zoom={effectiveScale} onZoom={handleZoom} onFit={handleFit} />}
      >
        <span className="wb-doc-meta">
          {natural
            ? t('explorer.viewer.image.dimensions', natural.w, natural.h)
            : t('explorer.viewer.loading')}
          <span className="wb-doc-meta-dot" aria-hidden="true">
            ·
          </span>
          {formatBytes(data.size)}
        </span>
      </DocToolbar>
      <div
        ref={stageRef}
        className={`wb-image-stage${panning ? ' is-panning' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        onDoubleClick={toggleActual}
      >
        <img
          className={zoom === null ? 'wb-image-el is-fit' : 'wb-image-el'}
          src={src}
          alt={path}
          draggable={false}
          style={width ? { width } : undefined}
          onLoad={(event) => {
            const img = event.currentTarget
            if (img.naturalWidth) setNatural({ w: img.naturalWidth, h: img.naturalHeight })
          }}
        />
      </div>
    </div>
  )
}
