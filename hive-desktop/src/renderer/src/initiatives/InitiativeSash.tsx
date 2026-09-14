import { useCallback, useRef } from 'react'
import { t } from '../i18n'

/**
 * The drag handle between the transcript and an open initiative's panel.
 *
 * ## Why this is not a `Resizable` group
 *
 * The obvious move is to make the split a second `Resizable` and let
 * `react-resizable-panels` do the work, the way the workbench's outer
 * rail/chat/viewer split does. It cannot: this split lives *inside* one of that
 * outer group's panels, and a nested group re-normalises the outer layout every
 * time the inner one's children change shape — measured on this very app, where
 * a panel that had just been expanded snapped back to its old size the moment
 * the rail mounted. (`WorkUI`'s `didToggle` machinery exists because of the
 * same class of behaviour.)
 *
 * So the split stays flex and the rail's width is a single custom property on
 * the split container. A drag is then one number written to one property —
 * no layout normalisation, no second source of truth for the outer panes, and
 * nothing for the compiler-ceilinged `WorkUI` to hold.
 *
 * The keyboard path is not an extra: a separator that only answers to a
 * pointer is a control a keyboard user cannot reach at all, and the WAI-ARIA
 * separator pattern is exactly the arrow keys people already try.
 */

/** How far the transcript may be squeezed, and how narrow the panel may get. */
const MIN_RAIL = 220
const MIN_CHAT = 320

/** One arrow press, in px — the same nudge the DS handle uses. */
const STEP = 24

export function InitiativeSash(): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)

  /** Writes a clamped rail width onto the split container, and reports it back. */
  const apply = useCallback((next: number): number => {
    const split = ref.current?.parentElement
    if (!split) return next
    const total = split.getBoundingClientRect().width
    const clamped = Math.max(MIN_RAIL, Math.min(next, Math.max(MIN_RAIL, total - MIN_CHAT)))
    split.style.setProperty('--wb-initctx-w', `${Math.round(clamped)}px`)
    return clamped
  }, [])

  /** The rail's width right now — read off the element rather than remembered, so a window resize never argues with a stale number. */
  const currentWidth = useCallback((): number => {
    const rail = ref.current?.nextElementSibling
    return rail instanceof HTMLElement ? rail.getBoundingClientRect().width : MIN_RAIL
  }, [])

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      // Pointer capture, so the drag survives the cursor crossing the
      // transcript, an iframe-backed viewer, or the window edge.
      event.currentTarget.setPointerCapture(event.pointerId)
      const split = ref.current?.parentElement
      if (!split) return
      const move = (moveEvent: PointerEvent): void => {
        // The rail is the RIGHT-hand half, so its width is the distance from
        // the pointer to the split's right edge.
        apply(split.getBoundingClientRect().right - moveEvent.clientX)
      }
      const up = (): void => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    },
    [apply]
  )

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      // Left grows the rail, right shrinks it: the arrow points at the edge
      // being moved, which is the direction the panel's boundary travels.
      const delta = event.key === 'ArrowLeft' ? STEP : event.key === 'ArrowRight' ? -STEP : null
      if (delta === null) return
      event.preventDefault()
      apply(currentWidth() + delta)
    },
    [apply, currentWidth]
  )

  return (
    <div
      ref={ref}
      className="wb-initctx-sash"
      role="separator"
      aria-orientation="vertical"
      aria-label={t('initiatives.resizePanel')}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
    />
  )
}
