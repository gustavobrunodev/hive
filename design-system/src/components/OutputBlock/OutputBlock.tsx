import { useId, useRef, useState, type ComponentPropsWithoutRef, type ReactNode } from "react"
import { cx } from "../../utils/cx"
import "./OutputBlock.css"

/** Semantic treatment of the frame. `danger` is for output that *is* the failure (stderr, a stack trace). */
export type OutputBlockTone = "neutral" | "danger"

// `onCopy` is deliberately shadowed: the DOM's own clipboard event handler is
// not what this component means by it, and inheriting both would be a trap.
export interface OutputBlockProps
  extends Omit<ComponentPropsWithoutRef<"div">, "children" | "onCopy"> {
  /** The text to show, verbatim. Whitespace is preserved; long lines wrap rather than scroll sideways. */
  text: string
  /** Small heading above the frame. Omit for an unlabelled block. */
  label?: ReactNode
  /** Right-aligned fine print in the header — a line count, a duration, an exit code. */
  meta?: ReactNode
  tone?: OutputBlockTone
  /**
   * Lines rendered before the block clips itself and offers to grow. `0`
   * disables the cap. Defaults to `12` — about one screenful of a command's
   * answer, past which a transcript stops being readable.
   */
  maxLines?: number
  /** Label for the grow control, given how many lines are hidden. Required to offer one. */
  moreLabel?: (hidden: number) => string
  /** Label for the same control once grown. */
  lessLabel?: string
  /**
   * Renders a leading prompt glyph (`$`, `›`) on the first line, so a command
   * reads as a command. Purely presentational — it is never part of `text`,
   * and never part of what {@link onCopy} receives.
   */
  prompt?: string
  /** Shows a copy control. Omit to render none — this component owns no clipboard access of its own. */
  onCopy?: (text: string) => void
  copyLabel?: string
  /** Shown on the copy control for ~1.6s after it is used. */
  copiedLabel?: string
  /** Standing note under the frame: a truncation warning, a source. */
  note?: ReactNode
  /** What to say when `text` is empty — the difference between "returned nothing" and "nothing captured". */
  emptyLabel?: ReactNode
  /**
   * The result has not arrived yet: renders shimmer bars in place of the text
   * and marks the region busy. A skeleton, not a spinner — the frame is
   * already on screen and only its content is missing.
   */
  pending?: boolean
}

/** Lines of shimmer while `pending`. Three reads as "a few lines of something", which is the honest promise. */
const SKELETON_LINES = 3

/**
 * A framed block of machine output — a command's answer, a tool result, a log
 * excerpt — with the four things such a block always ends up needing: a cap
 * that grows in place, a copy control, a truncation note, and a failure tone.
 *
 * ## Why it is not `CodeBlock`
 *
 * `CodeBlock` is for authored code in prose: it is uncapped, its highlighting
 * is hand-wrapped spans, and its copy button floats over the corner. This is
 * for text a machine produced and nobody curated — arbitrarily long, sometimes
 * empty, sometimes still arriving, and often the evidence for a failure. Those
 * are different problems, and solving them in `CodeBlock` would have made the
 * common case worse.
 *
 * Long lines wrap (`overflow-wrap: anywhere`) rather than scrolling sideways:
 * a horizontal scrollbar inside a vertical transcript is a place text goes to
 * be missed, and machine output has no meaningful line geometry to preserve.
 *
 * All copy is passed in — the component ships no strings, so the host owns
 * i18n.
 */
export function OutputBlock({
  text,
  label,
  meta,
  tone = "neutral",
  maxLines = 12,
  moreLabel,
  lessLabel,
  prompt,
  onCopy,
  copyLabel = "Copiar",
  copiedLabel = "Copiado",
  note,
  emptyLabel,
  pending = false,
  className,
  ...rest
}: OutputBlockProps) {
  const [grown, setGrown] = useState(false)
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bodyId = useId()

  const lines = text === "" ? [] : text.split("\n")
  const capped = maxLines > 0 && !grown && lines.length > maxLines
  const hidden = capped ? lines.length - maxLines : 0
  const shown = capped ? lines.slice(0, maxLines).join("\n") : text
  const canGrow = moreLabel !== undefined && (capped || grown)

  function handleCopy() {
    onCopy?.(text)
    setCopied(true)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className={cx("hds-out", `hds-out-${tone}`, className)} {...rest}>
      {(label !== undefined || meta !== undefined || onCopy !== undefined) && (
        <div className="hds-out-head">
          {label !== undefined && <span className="hds-out-label">{label}</span>}
          {meta !== undefined && <span className="hds-out-meta">{meta}</span>}
          {onCopy !== undefined && (
            <button
              type="button"
              className={cx("hds-out-copy", copied && "is-copied")}
              onClick={handleCopy}
              disabled={pending || text === ""}
            >
              {copied ? copiedLabel : copyLabel}
            </button>
          )}
        </div>
      )}
      {pending ? (
        <div className="hds-out-body hds-out-skel" aria-busy="true">
          {Array.from({ length: SKELETON_LINES }, (_, i) => (
            <span key={i} className="hds-out-skel-line" style={{ ["--i" as string]: String(i) }} />
          ))}
        </div>
      ) : text === "" ? (
        <p className="hds-out-empty">{emptyLabel}</p>
      ) : (
        <pre className="hds-out-body" id={bodyId} data-capped={capped || undefined} tabIndex={0}>
          {prompt !== undefined && (
            <span className="hds-out-prompt" aria-hidden="true">
              {prompt}
            </span>
          )}
          <code>{shown}</code>
        </pre>
      )}
      {(canGrow || note !== undefined) && (
        <div className="hds-out-foot">
          {canGrow && (
            <button
              type="button"
              className="hds-out-more"
              aria-expanded={grown}
              aria-controls={bodyId}
              onClick={() => setGrown((value) => !value)}
            >
              {grown ? lessLabel : moreLabel(hidden)}
            </button>
          )}
          {note !== undefined && <span className="hds-out-note">{note}</span>}
        </div>
      )}
    </div>
  )
}
