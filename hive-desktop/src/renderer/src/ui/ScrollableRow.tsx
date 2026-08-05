import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from './icons'

interface ScrollableRowProps {
  children?: ReactNode
  /** ARIA role for the track (`toolbar` for a row of controls, `list`, …). */
  role?: string
  ariaLabel: string
  /** Accessible names for the two paddles. */
  scrollBackLabel: string
  scrollForwardLabel: string
  className?: string
  /** Extra class on the inner track (existing layout rules keep working). */
  trackClassName?: string
}

/** Whether the user asked the OS to reduce motion — paddles then jump instead of gliding. */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * A horizontal track that admits it has more content.
 *
 * A row of chips with `overflow-x: auto` and the scrollbar suppressed is
 * invisible overflow: the shortcut strip above the composer was hiding 966 of
 * its 1641px — six of ten shortcuts — behind an edge that just looked like a
 * chip sliced in half. Nothing in the UI said "there is more here", and with no
 * scrollbar there was nothing to drag.
 *
 * So the overflow states itself, in the order a user meets them:
 *  - the content **fades** into each overflowing edge (a mask, not a hard cut,
 *    so a clipped chip reads as continuing rather than broken);
 *  - a **paddle** appears over that edge — one page (80% of the visible width)
 *    per press, the affordance a mouse user can actually hit;
 *  - a vertical **wheel** over the track scrolls it horizontally, for the
 *    trackpad-less case where there's nothing to swipe.
 * Keyboard users never needed any of this: the chips are real buttons, so Tab
 * already scrolls them into view.
 *
 * The paddles only exist while that edge has something hidden — no dead
 * controls pointing at nothing.
 */
export function ScrollableRow({
  children,
  role,
  ariaLabel,
  scrollBackLabel,
  scrollForwardLabel,
  className,
  trackClassName
}: ScrollableRowProps): React.JSX.Element {
  const trackRef = useRef<HTMLDivElement>(null)
  const [overflow, setOverflow] = useState({ start: false, end: false })

  const measure = useCallback((track: HTMLDivElement) => {
    // 1px of slack: sub-pixel layout leaves a permanent ~0.5px "overflow" that
    // would otherwise strand a paddle that can't scroll anywhere.
    const max = track.scrollWidth - track.clientWidth
    setOverflow({ start: track.scrollLeft > 1, end: track.scrollLeft < max - 1 })
  }, [])

  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    const update = (): void => measure(track)
    update()
    track.addEventListener('scroll', update, { passive: true })
    // The chat pane is resizable and the strip's content changes with the role,
    // so width alone can't be watched — observe the element itself.
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null
    observer?.observe(track)
    return () => {
      track.removeEventListener('scroll', update)
      observer?.disconnect()
    }
  }, [measure, children])

  function page(event: React.MouseEvent<HTMLButtonElement>, direction: -1 | 1): void {
    // The paddle sits in the same row as the track it drives, so the DOM
    // already answers "which track" — no nullable ref to re-check.
    const track =
      event.currentTarget.parentElement?.querySelector<HTMLDivElement>('.wb-scroll-row-track')
    track?.scrollBy({
      left: direction * Math.max(120, track.clientWidth * 0.8),
      behavior: prefersReducedMotion() ? 'auto' : 'smooth'
    })
  }

  function handleWheel(event: React.WheelEvent<HTMLDivElement>): void {
    // Only claim the gesture when it's purely vertical — a trackpad's own
    // horizontal scroll must stay untouched.
    if (event.deltaY === 0 || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return
    const track = event.currentTarget
    if (track.scrollWidth <= track.clientWidth) return
    track.scrollLeft += event.deltaY
  }

  return (
    <div className={['wb-scroll-row', className].filter(Boolean).join(' ')}>
      <button
        type="button"
        className="wb-scroll-row-paddle"
        data-edge="start"
        data-visible={overflow.start || undefined}
        aria-label={scrollBackLabel}
        title={scrollBackLabel}
        tabIndex={-1}
        aria-hidden={!overflow.start}
        onClick={(event) => page(event, -1)}
      >
        <ChevronLeftIcon size={14} />
      </button>
      <div
        ref={trackRef}
        className={['wb-scroll-row-track', trackClassName].filter(Boolean).join(' ')}
        data-overflow-start={overflow.start || undefined}
        data-overflow-end={overflow.end || undefined}
        role={role}
        aria-label={ariaLabel}
        onWheel={handleWheel}
      >
        {children}
      </div>
      <button
        type="button"
        className="wb-scroll-row-paddle"
        data-edge="end"
        data-visible={overflow.end || undefined}
        aria-label={scrollForwardLabel}
        title={scrollForwardLabel}
        tabIndex={-1}
        aria-hidden={!overflow.end}
        onClick={(event) => page(event, 1)}
      >
        <ChevronRightIcon size={14} />
      </button>
    </div>
  )
}
