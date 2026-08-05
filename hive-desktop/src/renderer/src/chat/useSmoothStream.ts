import { useEffect, useRef, useState } from 'react'

/**
 * Smooth reveal for a streaming reply (agent-activity AA-R4).
 *
 * The CLI does not hand us a character at a time — it hands us whatever
 * arrived on the socket, so a reply lands as a handful of fat chunks separated
 * by hundreds of milliseconds. Rendering each chunk the instant it arrives is
 * what made the reply appear in stuttering blocks: paragraphs materializing
 * whole, then a pause, then another. Nothing is wrong with the data; the
 * *pacing* is wrong.
 *
 * So the transport's chunkiness is decoupled from the reveal. Chunks fill a
 * buffer; a rAF loop drains it toward the caller at an exponential ease-out —
 * each frame reveals a fixed *fraction* of whatever is still unread. The
 * reveal is therefore fast when it's far behind (a 400-character chunk starts
 * pouring immediately) and gentle as it catches up, and it stays
 * frame-rate-independent, since the fraction comes from the real frame delta
 * rather than assuming 60fps.
 *
 * ## Grapheme safety
 *
 * The cursor advances over **grapheme clusters**, never UTF-16 code units.
 * Slicing a string at an arbitrary index splits emoji: a lone surrogate half
 * paints as `�`, and a ZWJ sequence (👩‍💻) briefly renders as its component
 * parts before snapping together. Both read as the "broken emoji rectangle"
 * bug, one frame at a time. `Intl.Segmenter` gives the real boundaries.
 */

/**
 * Time constant of the ease-out, in ms. Each frame closes ~`1 - e^(-dt/TAU)`
 * of the remaining distance, so at 60fps a fresh chunk is ~85% revealed within
 * ~150ms — fast enough to feel live, slow enough to read as flowing text
 * rather than a paste. Below ~60ms it stops reading as motion at all; above
 * ~150ms the reply visibly lags the agent.
 */
const TAU_MS = 90

/** Floor so a nearly-caught-up tail still advances instead of crawling by fractions. */
const MIN_GRAPHEMES_PER_FRAME = 1

/** Guard against a delta from a backgrounded tab dumping the whole buffer in one frame. */
const MAX_FRAME_DELTA_MS = 250

/**
 * Lazily-built segmenter (constructing one per call is measurably expensive
 * and this runs on every chunk). `undefined` until first use; `null` when the
 * runtime has no `Intl.Segmenter` at all.
 */
let segmenter: Intl.Segmenter | null | undefined

export function graphemesOf(text: string): string[] {
  if (segmenter === undefined) {
    segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter() : null
  }
  if (segmenter === null) {
    // No `Intl.Segmenter` (very old runtime): `Array.from` at least iterates by
    // code point, so surrogate pairs stay intact even though ZWJ sequences and
    // combining marks may still split.
    return Array.from(text)
  }
  return [...segmenter.segment(text)].map((entry) => entry.segment)
}

/** Whether the user asked the OS to reduce motion — the reveal is then instant. */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * Returns `target` revealed progressively.
 *
 * `target` is expected to only ever grow within one turn (it's an accumulating
 * buffer). When it stops being an extension of what's already shown — a new
 * turn, or the pane switching conversations — the reveal restarts from the
 * beginning of the new text rather than animating backwards.
 *
 * `null` (nothing streaming) passes straight through.
 */
export function useSmoothStream(target: string | null): string | null {
  const [revealed, setRevealed] = useState('')
  // The text already segmented, so a chunk only segments its own delta —
  // re-segmenting the whole buffer per chunk would be O(n²) over a long reply.
  const segmentedRef = useRef('')
  const graphemesRef = useRef<string[]>([])
  const cursorRef = useRef(0)
  const frameRef = useRef<number | null>(null)
  const lastFrameRef = useRef(0)
  const reduced = prefersReducedMotion()

  useEffect(() => {
    if (target === null) {
      segmentedRef.current = ''
      graphemesRef.current = []
      cursorRef.current = 0
      return
    }

    const previous = segmentedRef.current
    if (target.startsWith(previous)) {
      graphemesRef.current = graphemesRef.current.concat(graphemesOf(target.slice(previous.length)))
    } else {
      graphemesRef.current = graphemesOf(target)
      cursorRef.current = 0
    }
    segmentedRef.current = target

    if (reduced) return

    function advance(now: number): void {
      const graphemes = graphemesRef.current
      const backlog = graphemes.length - cursorRef.current
      if (backlog <= 0) {
        frameRef.current = null
        return
      }
      // The first frame after a pause has no meaningful delta; assume one
      // 60fps frame so a chunk arriving between rAFs isn't dumped whole.
      const delta =
        lastFrameRef.current === 0 ? 16 : Math.min(now - lastFrameRef.current, MAX_FRAME_DELTA_MS)
      lastFrameRef.current = now
      const step = Math.max(
        MIN_GRAPHEMES_PER_FRAME,
        Math.ceil(backlog * (1 - Math.exp(-delta / TAU_MS)))
      )
      cursorRef.current = Math.min(graphemes.length, cursorRef.current + step)
      setRevealed(graphemes.slice(0, cursorRef.current).join(''))
      frameRef.current = requestAnimationFrame(advance)
    }

    if (frameRef.current === null) {
      lastFrameRef.current = 0
      frameRef.current = requestAnimationFrame(advance)
    }
    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
    }
  }, [target, reduced])

  // Derived, not stored: nothing streaming and reduced-motion both resolve
  // straight from `target`, so the effect never has to call `setState`
  // synchronously (which would cascade a render on every chunk). The prefix
  // check is what keeps a *new* turn from flashing the previous turn's tail
  // for the one frame before the loop resets the cursor.
  if (target === null) return null
  if (reduced) return target
  return target.startsWith(revealed) ? revealed : ''
}
