import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { t } from '../i18n'
import { formatReadout, scaleFor } from './stageScale'
import type { Viewport } from './viewport'

/**
 * Design Studio (M18) — T4.5/T4.6. The bench the Preview sits on.
 *
 * **Three surfaces, zero `box-shadow` (D-DS-9).** `DESIGN.md`'s
 * Flat-Until-It-Floats rule reserves `--shadow-1..3` for portalled surfaces,
 * and a device mock-up is not portalled — it is the page's subject. Depth here
 * comes from stacking the surface roles the system already has: the bench is
 * `--bg-2` (deeper than any panel), the bezel is `--bg` with a
 * `--border-strong` hairline, the screen is `--surface`. Three tones read as
 * real depth, and because they are roles rather than values they stay correct
 * in every theme — which a hand-tuned shadow would not.
 *
 * **The dot grid is not decoration.** It is what separates *a workspace* from
 * *a panel*, and it is the convention of the category the audience already
 * knows (Figma, Framer, tldraw). It withdraws under `forced-colors`, where a
 * texture the user did not ask for is noise on top of a palette they chose.
 *
 * **The scale is on the container, never on the frame (D-DS-7).** The device
 * keeps its real pixel size and the wrapper is transformed. Because a transform
 * does not shrink the layout box, the wrapper reclaims the difference with
 * negative margins — otherwise a Desktop preset would reserve 1440px of bench
 * and put a scrollbar under a Preview that visibly fits.
 */

export interface StagePaneProps {
  /** The device the stage is pretending to be. */
  viewport: Viewport
  /** The Preview frame, rendered at the device's real size. */
  children?: ReactNode
  /**
   * Shown **on** the bench instead of the device, at 100% (T7.5).
   *
   * The visual pass found the Tela-with-no-Components state rendered *inside*
   * the device, which at a Desktop preset on a real column is scaled to ~46% —
   * so the one thing that state exists to do, teach, arrived at 7px. A Tela
   * with no Components has no device worth showing anyway: there is nothing to
   * judge at a device size. The bench and its grid stay, so the stage still
   * reads as the workspace it is (§3.10) rather than blinking out.
   */
  placeholder?: ReactNode
}

/**
 * The bench's inner width, kept live. `ResizeObserver` rather than a window
 * listener: the bench changes width when a *column* is dragged, which no window
 * event reports.
 */
function useBenchWidth(ref: React.RefObject<HTMLDivElement | null>): number {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const element = ref.current
    if (element === null) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) setWidth(entry.contentRect.width)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])

  return width
}

export function StagePane({ viewport, children, placeholder }: StagePaneProps): React.JSX.Element {
  const benchRef = useRef<HTMLDivElement>(null)
  const benchWidth = useBenchWidth(benchRef)
  const scale = scaleFor(benchWidth, viewport.width)

  return (
    <div className="wb-dstudio-bench" aria-label={t('designStudio.stageAria')} ref={benchRef}>
      <div className="wb-dstudio-bench-grid" aria-hidden="true" />
      {placeholder !== undefined ? (
        <div className="wb-dstudio-bench-placeholder">{placeholder}</div>
      ) : (
        <div className="wb-dstudio-bench-content">
          <div
            className="wb-dstudio-scale"
            data-scale={scale}
            style={{
              transform: `scale(${scale})`,
              marginRight: `${-viewport.width * (1 - scale)}px`,
              marginBottom: `${-viewport.height * (1 - scale)}px`
            }}
          >
            <div className="wb-dstudio-device">
              <div className="wb-dstudio-screen">{children}</div>
            </div>
          </div>
          <p className="wb-dstudio-readout">
            {formatReadout(viewport.width, viewport.height, scale)}
          </p>
        </div>
      )}
    </div>
  )
}
