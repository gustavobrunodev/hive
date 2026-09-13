import { useRef, useState, type ComponentPropsWithoutRef, type ReactNode } from "react"
import { cx } from "../../utils/cx"
import "./CodeFence.css"

// `onCopy` is deliberately shadowed, same as `OutputBlock`: the DOM's own
// clipboard event is not what this component means by it, and inheriting both
// would be a trap.
export interface CodeFenceProps
  extends Omit<ComponentPropsWithoutRef<"div">, "children" | "onCopy"> {
  /** The rendered block content — usually a `<code>` element with its highlighted runs. */
  children: ReactNode
  /**
   * The plain text the copy control puts on the clipboard. Separate from
   * `children` because what is *rendered* is a tree of spans and what is
   * *copied* must be the source, byte for byte: copying `textContent` off the
   * DOM inserts a space at every element boundary, which turns a highlighted
   * line into code that no longer runs.
   */
  code: string
  /** Language tag shown in the header (`ts`, `bash`, `json`). Omit for an untagged block. */
  language?: string
  /**
   * Puts `code` on the clipboard. The component owns no clipboard access of
   * its own — the host does, because a desktop shell and a web page reach it
   * by different routes. Omit to render no copy control.
   */
  onCopy?: (code: string) => void
  /** Accessible name for the copy control. */
  copyLabel?: string
  /** Accessible name + text shown for ~1.6s after a successful copy. */
  copiedLabel?: string
}

/** How long the control stays in its "done" state. Long enough to read, short enough not to lie. */
const COPIED_MS = 1600

function CopyGlyph(): React.JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="5.75" y="5.75" width="8.5" height="8.5" rx="1.75" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M10.5 3.75A1.75 1.75 0 0 0 8.75 2h-5A1.75 1.75 0 0 0 2 3.75v5c0 .966.784 1.75 1.75 1.75"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

function CheckGlyph(): React.JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 8.5 6.3 12 13 4.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * A fenced code block as it appears **inside prose** — an agent's reply, a
 * rendered `.md` — with the control everyone now reaches for without looking:
 * copy, in the top-right corner.
 *
 * ## Why it is neither of the two blocks that already existed
 *
 * `CodeBlock` is the brand register: a hand-lit listing on a fixed near-black
 * plate, sized for a marketing page, copying through `navigator.clipboard`
 * directly. `OutputBlock` is machine output — capped, growable, sometimes
 * empty, sometimes still arriving, often the evidence for a failure.
 *
 * This is the third thing: a block **the document owns**. It is as long as the
 * author made it (no cap — truncating a snippet somebody is about to run is a
 * worse failure than a long block), it sits on the page's own surfaces so a
 * reply reads as one document rather than a strip of foreign plates, and its
 * only affordance is taking the text away.
 *
 * ## The three decisions inside it
 *
 * - **The control rests quiet and arrives on approach.** At rest it is a faint
 *   outline; hover or keyboard focus anywhere in the block brings it up. A
 *   button that is always at full strength competes with the code for the
 *   corner, and one that only exists on `:hover` cannot be reached by keyboard
 *   at all — so the reveal is driven by `:focus-within` too, and the control
 *   keeps its place in the tab order either way.
 * - **It is positioned against the block, not the scroller.** Long lines scroll
 *   sideways inside `pre`; a control parented to that would ride away with
 *   them. The frame is the positioned element and the `pre` scrolls inside it.
 * - **What it copies is `code`, never the DOM.** See that prop.
 *
 * All copy is passed in — the component ships no strings, so the host owns i18n.
 */
export function CodeFence({
  children,
  code,
  language,
  onCopy,
  copyLabel = "Copiar",
  copiedLabel = "Copiado",
  className,
  ...rest
}: CodeFenceProps) {
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleCopy() {
    onCopy?.(code)
    setCopied(true)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setCopied(false), COPIED_MS)
  }

  return (
    // Everything the caller passes lands on the FRAME, not on the `pre`: the
    // frame is the block. A host anchoring a scroll target or a test hook to
    // this component means the whole thing, and the `pre` inside it starts one
    // header-strip lower than the block does.
    <div className={cx("hds-fence", className)} {...rest}>
      <div className="hds-fence-bar">
        {language !== undefined && language !== "" && (
          <span className="hds-fence-lang">{language}</span>
        )}
        {onCopy !== undefined && (
          <button
            type="button"
            className={cx("hds-fence-copy", copied && "is-copied")}
            onClick={handleCopy}
            // The label changes with the state, so it is the accessible name
            // too — a control that says "Copiar" after it has copied tells a
            // screen-reader user nothing happened.
            aria-label={copied ? copiedLabel : copyLabel}
          >
            {copied ? <CheckGlyph /> : <CopyGlyph />}
            <span className="hds-fence-copy-text">{copied ? copiedLabel : copyLabel}</span>
          </button>
        )}
      </div>
      {/* `tabIndex` so a block wider than the column can be scrolled from the
          keyboard — an `overflow: auto` region is only reachable that way when
          it is focusable. */}
      <pre tabIndex={0}>{children}</pre>
    </div>
  )
}
