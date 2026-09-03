import { useEffect, useRef, useState } from 'react'
import { t } from '../i18n'
import { BrainIcon, ChevronRightIcon } from '../ui/icons'
import { formatDuration } from './turnTiming'

interface ReasoningBlockProps {
  /** The reasoning text streamed so far. */
  text: string
  /** `false` while the agent is still thinking — drives the live treatment. */
  settled: boolean
  /**
   * How long this stretch of reasoning lasted, in ms. Recorded on the block
   * when it settles; absent on a conversation restored from disk, which simply
   * names the row without a duration rather than inventing one.
   */
  ms?: number
}

/**
 * The agent thinking out loud.
 *
 * ## Why this block exists
 *
 * The reported defect was *"sempre aparece: Iniciando"* — and it was true.
 * `turnPhase()` can only report `starting` while a turn has produced nothing,
 * and Devin produces nothing for the first several seconds of every turn: it
 * is reasoning, and nothing in the old event stream carried reasoning. So the
 * user watched a static label for the part of the turn where the most was
 * actually happening.
 *
 * Filling that silence with a spinner would have been the easy answer and the
 * wrong one — a spinner says "something is happening", which is the one thing
 * the user had already guessed. This shows *what* is happening, in the agent's
 * own words, as it happens.
 *
 * ## The two states
 *
 * **Live** — the text streams into a short, tail-locked window. It is capped
 * (`--reasoning-live-max`) rather than left to grow, because reasoning easily
 * runs longer than the reply and an uncapped block would push the composer
 * off-screen and steal the scroll position from the answer the user is waiting
 * for. The top edge fades into the background instead of ending on a hard
 * line, so the window reads as *a view onto a longer stream* rather than as a
 * box that happens to be full.
 *
 * **Settled** — it collapses to one quiet line naming what it cost
 * ("Raciocinou por 4s"), openable if the user wants the detail. Reasoning is
 * working-out, not the product: it earns space while it is the only thing
 * happening and gives that space back the moment the reply starts.
 *
 * ## Deliberately not a terminal
 *
 * PRODUCT.md's anti-references name "monospace-everything" and "log-dump UIs".
 * Reasoning is prose — the model writes it in sentences — so it is set in the
 * body face at the tertiary size, in `--muted`, which keeps it legibly below
 * the reply without dropping under the 4.5:1 floor.
 */
export function ReasoningBlock({ text, settled, ms }: ReasoningBlockProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  // Whether the stream is taller than its window. Drives the top fade, which
  // must not be on by default: with three lines of text and nothing to scroll,
  // a permanent gradient just dims the first line of the only thing on screen.
  // (It did exactly that, and the first line was the least readable text in
  // the app.)
  const [overflowing, setOverflowing] = useState(false)
  const tailRef = useRef<HTMLDivElement | null>(null)

  // Tail-lock: the newest reasoning is the only part worth showing, and the
  // window is too short to scroll by hand while it streams.
  useEffect(() => {
    if (settled) return
    const node = tailRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
    setOverflowing(node.scrollHeight > node.clientHeight + 1)
  }, [text, settled])

  if (!settled) {
    return (
      <div className="wb-reasoning" data-live>
        <div className="wb-reasoning-head">
          <BrainIcon size={13} aria-hidden="true" />
          <span className="wb-reasoning-label">{t('reasoning.live')}</span>
        </div>
        <div
          className="wb-reasoning-stream"
          data-fade={overflowing || undefined}
          ref={tailRef}
          aria-live="polite"
        >
          {text}
        </div>
      </div>
    )
  }

  return (
    <div className="wb-reasoning" data-settled>
      <button
        type="button"
        className="wb-reasoning-toggle"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <ChevronRightIcon size={12} aria-hidden="true" className="wb-reasoning-chevron" />
        <BrainIcon size={13} aria-hidden="true" />
        <span className="wb-reasoning-label">
          {ms !== undefined
            ? t('reasoning.settled', formatDuration(ms))
            : t('reasoning.settledPlain')}
        </span>
        <span className="wb-reasoning-hint">
          {open ? t('reasoning.collapse') : t('reasoning.expand')}
        </span>
      </button>
      {open && <div className="wb-reasoning-full">{text}</div>}
    </div>
  )
}
