import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import { t } from '../../i18n'
import { DocError, DocLoading, DocToolbar, ZoomControls } from './docViewerShared'
import { clampZoom } from './docViewerCore'
import { IconButton } from '../../ui/IconButton'
import { ChevronLeftIcon, ChevronRightIcon } from '../../ui/icons'

/**
 * pdf.js is imported lazily (only when a PDF is actually opened): the library
 * touches browser-only globals like `DOMMatrix` at module scope, which the
 * jsdom test environment lacks, and it's a heavy bundle no other file should
 * pay for. The worker is bundled by Vite as a same-origin asset, so it loads
 * under the renderer's `script-src 'self'` CSP — no CDN, no `blob:`/eval
 * fake-worker. Configured once, memoised across opens.
 */
type PdfjsModule = typeof import('pdfjs-dist')
let pdfjsPromise: Promise<PdfjsModule> | null = null
async function loadPdfjs(): Promise<PdfjsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjsLib = await import('pdfjs-dist')
      const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl
      return pdfjsLib
    })()
  }
  return pdfjsPromise
}

/** Cap the render backing scale so hi-DPI displays don't allocate enormous canvases. */
const DPR = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2)

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; numPages: number; base: { w: number; h: number } }

/**
 * PDF viewer. Bytes come over IPC (base64) and render entirely client-side
 * with pdf.js onto `<canvas>` — no plugin, no `object`/`embed`, so it works
 * under the strict renderer CSP. Pages render lazily as they scroll into a
 * continuous document, with fit-to-width by default, zoom, a live page
 * indicator, and prev/next paging.
 */
export function PdfViewer({
  workspace,
  path
}: {
  workspace: string
  path: string
}): React.JSX.Element {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [zoom, setZoom] = useState<number | null>(null) // null = fit-to-width
  const [current, setCurrent] = useState(1)

  const docRef = useRef<PDFDocumentProxy | null>(null)
  // The loading task owns `destroy()` (which also tears down the worker); the
  // proxy only exposes `cleanup()`, so we keep the task for teardown.
  const loadingTaskRef = useRef<PDFDocumentLoadingTask | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollWidth, setScrollWidth] = useState(0)
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map())
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const renderedScale = useRef<Map<number, number>>(new Map())
  const renderTasks = useRef<Map<number, RenderTask>>(new Map())

  // --- load the document -------------------------------------------------
  useEffect(() => {
    let cancelled = false
    canvasRefs.current.clear()
    pageRefs.current.clear()
    renderedScale.current.clear()
    const run = async (): Promise<void> => {
      // Reset view state inside the async callback (not the effect body) per
      // react-hooks/set-state-in-effect — same pattern the explorer uses.
      setLoad({ status: 'loading' })
      setCurrent(1)
      setZoom(null)
      try {
        const pdfjsLib = await loadPdfjs()
        const bin = await window.hive.fs.readBinary(workspace, path)
        if (cancelled) return
        const task = pdfjsLib.getDocument({ data: base64ToBytes(bin.base64) })
        loadingTaskRef.current = task
        const doc = await task.promise
        if (cancelled) {
          void task.destroy()
          return
        }
        docRef.current = doc
        const page1 = await doc.getPage(1)
        const viewport = page1.getViewport({ scale: 1 })
        setLoad({
          status: 'ready',
          numPages: doc.numPages,
          base: { w: viewport.width, h: viewport.height }
        })
      } catch {
        if (!cancelled) setLoad({ status: 'error' })
      }
    }
    void run()
    return () => {
      cancelled = true
      renderTasks.current.forEach((task) => task.cancel())
      renderTasks.current.clear()
      void loadingTaskRef.current?.destroy()
      loadingTaskRef.current = null
      docRef.current = null
    }
  }, [workspace, path, attempt])

  // Track the scroll container width so "fit" is a real width-based scale.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect
      if (box) setScrollWidth(box.width)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [load.status])

  const base = load.status === 'ready' ? load.base : null
  // 48px accounts for the page's horizontal breathing room in the scroll area.
  const fitScale = base && scrollWidth > 0 ? Math.max(0.1, (scrollWidth - 48) / base.w) : 1
  const scale = zoom ?? fitScale

  const renderPage = useCallback(
    async (pageNum: number): Promise<void> => {
      const doc = docRef.current
      const canvas = canvasRefs.current.get(pageNum)
      if (!doc || !canvas) return
      if (renderedScale.current.get(pageNum) === scale) return
      renderedScale.current.set(pageNum, scale)
      renderTasks.current.get(pageNum)?.cancel()
      try {
        const page = await doc.getPage(pageNum)
        const viewport = page.getViewport({ scale: scale * DPR })
        const context = canvas.getContext('2d')
        if (!context) return
        canvas.width = viewport.width
        canvas.height = viewport.height
        const task = page.render({ canvas, canvasContext: context, viewport })
        renderTasks.current.set(pageNum, task)
        await task.promise
      } catch {
        // A cancelled render (scale change / unmount) rejects — reset so the
        // page re-renders at the new scale rather than staying blank.
        renderedScale.current.delete(pageNum)
      }
    },
    [scale]
  )

  // Lazy render: draw pages as they approach the viewport, and keep a live
  // "current page" indicator from whichever page dominates the view.
  useEffect(() => {
    if (load.status !== 'ready') return
    const root = scrollRef.current
    if (!root) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const pageNum = Number((entry.target as HTMLElement).dataset.page)
          if (entry.isIntersecting) {
            void renderPage(pageNum)
            if (entry.intersectionRatio > 0.5) setCurrent(pageNum)
          }
        }
      },
      { root, rootMargin: '200px 0px', threshold: [0, 0.5, 1] }
    )
    pageRefs.current.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [load.status, renderPage])

  // On zoom change, redraw every page that was already drawn (its cached scale
  // no longer matches), so visible pages stay crisp instead of scaling a bitmap.
  useEffect(() => {
    if (load.status !== 'ready') return
    renderedScale.current.forEach((_, pageNum) => void renderPage(pageNum))
  }, [scale, load.status, renderPage])

  const goToPage = useCallback((pageNum: number) => {
    pageRefs.current.get(pageNum)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  if (load.status === 'loading') return <DocLoading label={t('explorer.viewer.pdf.rendering')} />
  if (load.status === 'error') return <DocError onRetry={retry} />

  return (
    <div className="wb-doc wb-pdf-viewer">
      <DocToolbar
        end={
          <ZoomControls
            zoom={scale}
            onZoom={(next) => setZoom(clampZoom(next))}
            onFit={() => setZoom(null)}
          />
        }
      >
        <div className="wb-pdf-pager">
          <IconButton
            label={t('explorer.viewer.pdf.prevPage')}
            onClick={() => goToPage(Math.max(1, current - 1))}
            disabled={current <= 1}
          >
            <ChevronLeftIcon />
          </IconButton>
          <span className="wb-doc-zoom-value" aria-live="polite">
            {t('explorer.viewer.pdf.pageOf', current, load.numPages)}
          </span>
          <IconButton
            label={t('explorer.viewer.pdf.nextPage')}
            onClick={() => goToPage(Math.min(load.numPages, current + 1))}
            disabled={current >= load.numPages}
          >
            <ChevronRightIcon />
          </IconButton>
        </div>
      </DocToolbar>

      <div ref={scrollRef} className="wb-pdf-scroll">
        <div className="wb-pdf-pages">
          {Array.from({ length: load.numPages }, (_, i) => {
            const pageNum = i + 1
            return (
              <div
                key={pageNum}
                data-page={pageNum}
                ref={(el) => {
                  if (el) pageRefs.current.set(pageNum, el)
                  else pageRefs.current.delete(pageNum)
                }}
                className="wb-pdf-page"
                style={{
                  width: base ? base.w * scale : undefined,
                  height: base ? base.h * scale : undefined
                }}
              >
                <canvas
                  className="wb-pdf-canvas"
                  ref={(el) => {
                    if (el) canvasRefs.current.set(pageNum, el)
                    else canvasRefs.current.delete(pageNum)
                  }}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
