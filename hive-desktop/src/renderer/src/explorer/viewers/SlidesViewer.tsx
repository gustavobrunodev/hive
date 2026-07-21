import { useCallback, useEffect, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Empty } from '@hive/design-system'
import { t } from '../../i18n'
import { IconButton } from '../../ui/IconButton'
import { ChevronLeftIcon, ChevronRightIcon } from '../../ui/icons'
import { DocError, DocLoading, DocToolbar } from './docViewerShared'
import { useAsyncDocument } from './docViewerCore'

/**
 * Structural mirror of `main/documentReader.ts`'s `Slide` — kept local (like
 * `Explorer`'s `FsTreeNode`/`EntryMeta`) so the viewer stays self-contained
 * inside `explorer/**` rather than importing across the main/renderer boundary.
 * `window.hive.fs.readSlides()`'s resolved value is structurally identical.
 */
interface Slide {
  index: number
  title: string | null
  bullets: { text: string; level: number }[]
  images: string[]
}

/** One rendered slide surface (16:9): title, outline-indented body, and any embedded images. */
function SlideSurface({ slide }: { slide: Slide }): React.JSX.Element {
  const hasContent = slide.title || slide.bullets.length > 0 || slide.images.length > 0
  return (
    <div className="wb-slide-surface">
      {slide.title && <h2 className="wb-slide-title">{slide.title}</h2>}
      {slide.bullets.length > 0 && (
        <ul className="wb-slide-body">
          {slide.bullets.map((bullet, index) => (
            <li key={index} className="wb-slide-bullet" data-level={Math.min(bullet.level, 4)}>
              {bullet.text}
            </li>
          ))}
        </ul>
      )}
      {slide.images.length > 0 && (
        <div className="wb-slide-images">
          {slide.images.map((src, index) => (
            <img
              key={index}
              src={src}
              alt="" /* i18n-exempt: decorative slide image, empty alt is correct */
              className="wb-slide-image"
              draggable={false}
            />
          ))}
        </div>
      )}
      {!hasContent && <p className="wb-slide-empty">{t('explorer.viewer.slides.noText')}</p>}
    </div>
  )
}

/**
 * `.pptx` viewer. The deck is parsed in main into an ordered, reader-fidelity
 * slide list (title + body text + embedded images); here it becomes a
 * presentation surface — one 16:9 stage at a time, arrow-key and button
 * navigation, and a clickable thumbnail filmstrip. Labeled as a reading view,
 * since it reflows text rather than reproducing the exact authored layout.
 */
export function SlidesViewer({
  workspace,
  path
}: {
  workspace: string
  path: string
}): React.JSX.Element {
  const load = useCallback(() => window.hive.fs.readSlides(workspace, path), [workspace, path])
  const { status, data, reload } = useAsyncDocument(load, path)
  const [active, setActive] = useState(0)

  // Reset to the first slide on a new file (setState wrapped in a callback
  // invoked from the effect, per react-hooks/set-state-in-effect).
  useEffect(() => {
    const reset = (): void => setActive(0)
    reset()
  }, [path])

  const slides = data?.slides ?? []
  const total = slides.length
  const go = useCallback(
    (delta: number) => setActive((current) => Math.min(total - 1, Math.max(0, current + delta))),
    [total]
  )
  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault()
        go(1)
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault()
        go(-1)
      }
    },
    [go]
  )

  if (status === 'loading') return <DocLoading />
  if (status === 'error' || !data) return <DocError onRetry={reload} />
  if (total === 0) {
    return (
      <div className="wb-doc wb-slides-viewer">
        <div className="wb-pane-center">
          <Empty title={t('explorer.viewer.slides.empty')} />
        </div>
      </div>
    )
  }

  const current = Math.min(active, total - 1)

  return (
    <div className="wb-doc wb-slides-viewer" tabIndex={0} onKeyDown={onKeyDown}>
      <DocToolbar
        end={
          <div className="wb-slides-nav">
            <IconButton
              label={t('explorer.viewer.slides.prev')}
              onClick={() => go(-1)}
              disabled={current === 0}
            >
              <ChevronLeftIcon />
            </IconButton>
            <span className="wb-doc-zoom-value" aria-live="polite">
              {t('explorer.viewer.slides.slideOf', current + 1, total)}
            </span>
            <IconButton
              label={t('explorer.viewer.slides.next')}
              onClick={() => go(1)}
              disabled={current === total - 1}
            >
              <ChevronRightIcon />
            </IconButton>
          </div>
        }
      >
        <span className="wb-doc-meta">{t('explorer.viewer.slides.readerNote')}</span>
      </DocToolbar>

      <div className="wb-slide-stage">
        <SlideSurface slide={slides[current]} />
      </div>

      <div
        className="wb-slide-filmstrip"
        role="tablist"
        aria-label={t('explorer.viewer.slides.thumbnailsLabel')}
      >
        {slides.map((slide, index) => (
          <button
            key={index}
            type="button"
            role="tab"
            aria-selected={index === current}
            className={index === current ? 'wb-slide-thumb is-active' : 'wb-slide-thumb'}
            onClick={() => setActive(index)}
          >
            <span className="wb-slide-thumb-num">{index + 1}</span>
            <span className="wb-slide-thumb-title">
              {slide.title || slide.bullets[0]?.text || t('explorer.viewer.slides.noText')}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
