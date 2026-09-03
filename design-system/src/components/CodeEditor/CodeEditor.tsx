import * as React from "react"
import { cx } from "../../utils/cx"
import { highlightLines, languageFor, type CodeLanguage } from "./syntax"
import "./CodeEditor.css"

/**
 * A per-line change mark, drawn as a bar in the number column. The vocabulary
 * is git's, but the component knows nothing about git — a caller hands it an
 * array as long as the file's lines, and it paints what it is given.
 */
export type CodeChangeMark = "add" | "modified" | "deleted"

export interface CodeEditorProps {
  /** Controlled source. Required: a mirror can only paint text it is given. */
  value: string
  onChange: (value: string) => void
  /**
   * The file being edited. The grammar is read off its name, so the caller
   * never has to keep an extension table of its own — and a file type nobody
   * mapped falls back to plain ink rather than to a wrong colouring.
   */
  filename?: string
  /** Overrides the grammar `filename` would have chosen. */
  language?: CodeLanguage | null
  /** Accessible name — the surface has no visible label of its own. */
  ariaLabel: string
  readOnly?: boolean
  spellCheck?: boolean
  /**
   * Soft-wrap long lines (the default). Off gives a horizontally scrolling
   * surface where source line *n* is always exactly one screen row.
   */
  wrap?: boolean
  /** The numbered column at the left (default on). */
  lineNumbers?: boolean
  /**
   * A wash on the row the caret is in, while the field has focus (default on).
   * Off for a read-only surface, where there is no caret to follow.
   */
  currentLine?: boolean
  /**
   * One entry per source line — `null` for an unchanged line. Shorter arrays
   * simply leave the rest of the file unmarked, so a caller can hand over a
   * stale array mid-keystroke without the marks jumping.
   */
  marks?: ReadonlyArray<CodeChangeMark | null>
  className?: string
  onScroll?: (event: React.UIEvent<HTMLTextAreaElement>) => void
}

/**
 * A text editor that paints its own syntax.
 *
 * ## Why this and not a plain textarea
 *
 * Because an editor with one ink for every character makes the reader do the
 * parser's job. Structure that a colour would have handed over in a glance —
 * where the string ends, which word is the key and which is the value, that
 * this line is a comment and not code — has to be re-derived character by
 * character instead. Every IDE has answered this the same way for thirty
 * years, and a file editor that does not is the "wrapped terminal" this
 * product's own anti-references warn against.
 *
 * ## Why this and not a code-editor library
 *
 * Because the platform already ships the hard parts. CodeMirror and Monaco
 * replace the browser's text field with a simulated one, and inherit the whole
 * job of re-implementing the caret, the selection, undo, IME, spellcheck,
 * accessibility and native find — for a pane whose job is "let me fix this
 * line in a markdown file". Here the real `<textarea>` stays exactly where it
 * was, on top, with transparent glyphs; a `<pre>` behind it renders the same
 * characters in colour, and the two are held in alignment by sharing every
 * metric that affects layout. Nothing can swallow a keystroke, because nothing
 * is between the user and the field.
 *
 * The one strict contract that technique has is documented on `CodeRun`: the
 * mirror must reproduce the source character for character. It does; the
 * grammar tests hold it to that.
 *
 * ## Why the mirror is one block per line
 *
 * Because everything an IDE puts *beside* a line — its number, its change bar,
 * the wash under the caret — has to know where that line ends up on screen,
 * and a line that soft-wraps is three rows tall. A parallel column of
 * fixed-height cells can only be right while nothing wraps, which is why the
 * gutter used to force wrapping off and leave prose running off the right edge
 * of a narrow pane. With one block per source line the browser answers the
 * question for us: the number is positioned against its own line's box, so it
 * is correct at every width, for free.
 */
export const CodeEditor = React.forwardRef<HTMLTextAreaElement, CodeEditorProps>(
  function CodeEditor(
    {
      value,
      onChange,
      filename,
      language,
      ariaLabel,
      readOnly = false,
      spellCheck = false,
      wrap = true,
      lineNumbers = true,
      currentLine = true,
      marks,
      className,
      onScroll,
    },
    forwardedRef
  ) {
    const rootRef = React.useRef<HTMLDivElement>(null)
    const mirrorRef = React.useRef<HTMLPreElement>(null)
    const codeRef = React.useRef<HTMLElement>(null)
    const washRef = React.useRef<HTMLDivElement>(null)
    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null)
    const currentNode = React.useRef<HTMLElement | null>(null)

    const setNode = React.useCallback(
      (node: HTMLTextAreaElement | null) => {
        textareaRef.current = node
        if (typeof forwardedRef === "function") forwardedRef(node)
        else if (forwardedRef) {
          ;(forwardedRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = node
        }
      },
      [forwardedRef]
    )

    const grammar = language === undefined ? languageFor(filename) : language
    const lines = React.useMemo(() => highlightLines(value, grammar), [value, grammar])

    /**
     * Puts the wash on the row the caret is in.
     *
     * Deliberately not React state: the caret moves on every arrow key, and a
     * re-render per keystroke means rebuilding every line of a long file to
     * change one attribute. The one node that changes is touched directly, and
     * the wash — a sibling of the mirror rather than a background on the line,
     * so it can span the number column too — is placed from that node's own
     * measured box, which is what makes it as tall as a line that wrapped.
     */
    const placeWash = React.useCallback(() => {
      const wash = washRef.current
      const textarea = textareaRef.current
      if (!wash || !textarea) return
      const node = currentNode.current
      if (!currentLine || node === null) {
        wash.hidden = true
        return
      }
      wash.hidden = false
      wash.style.top = `${node.offsetTop - textarea.scrollTop}px`
      wash.style.height = `${node.offsetHeight}px`
    }, [currentLine])

    const readCaret = React.useCallback(() => {
      const textarea = textareaRef.current
      const code = codeRef.current
      // The whole feature, not just its wash: with it off, no line is marked
      // at all — `data-current` also brightens that line's number, and a
      // caller who turned the row off did not ask for half of it.
      if (!currentLine || !textarea || !code) return
      const caret = textarea.selectionStart ?? 0
      // Counted rather than sliced: this runs on every caret move, and
      // `value.slice(0, caret)` copies up to a whole file each time.
      let index = 0
      for (let at = 0; at < caret; at++) {
        if (textarea.value.charCodeAt(at) === 10) index++
      }
      const node = code.children[index]
      if (!(node instanceof HTMLElement) || node === currentNode.current) {
        placeWash()
        return
      }
      currentNode.current?.removeAttribute("data-current")
      node.setAttribute("data-current", "")
      currentNode.current = node
      placeWash()
    }, [currentLine, placeWash])

    /**
     * The mirror follows the field, never the other way round. Both axes: a
     * no-wrap surface scrolls sideways too, and a mirror that only tracked the
     * vertical would peel away from the text the moment a long line is read.
     */
    const sync = React.useCallback(() => {
      const textarea = textareaRef.current
      if (!textarea) return
      if (mirrorRef.current) {
        mirrorRef.current.scrollTop = textarea.scrollTop
        mirrorRef.current.scrollLeft = textarea.scrollLeft
      }
      const root = rootRef.current
      if (root) {
        // How much the field's own scrollbars took. Measured rather than
        // assumed: it is 0 where the platform draws overlay bars and ~15px
        // where it draws classic ones, and getting it wrong is not a cosmetic
        // error — the mirror would wrap at a different column than the field,
        // and every colour below the fold would sit on the wrong word.
        root.style.setProperty("--editor-bar-w", `${textarea.offsetWidth - textarea.clientWidth}px`)
        root.style.setProperty(
          "--editor-bar-h",
          `${textarea.offsetHeight - textarea.clientHeight}px`
        )
        // The numbers are pinned to the left edge while long lines slide under
        // them: they live inside the scrolled mirror (which is what keeps them
        // beside their own wrapped line), so they are pushed back by exactly
        // what the mirror was scrolled by.
        root.style.setProperty("--editor-scroll-x", `${textarea.scrollLeft}px`)
      }
      placeWash()
    }, [placeWash])

    // Text can arrive without anyone scrolling — a reload, a save that rewrites
    // the buffer, an external edit — and that moves `scrollTop` without ever
    // firing a scroll event. Re-syncing on the value is what keeps the colours
    // from sitting one screen away from the words after a reload.
    React.useLayoutEffect(() => {
      // The column is exactly as wide as the widest number it has to hold, so
      // a 40-line note does not carry the indent of a 4 000-line one.
      rootRef.current?.style.setProperty("--editor-digits", String(`${lines.length}`.length))
      sync()
      readCaret()
    }, [value, wrap, lines.length, sync, readCaret])

    // A pane being resized changes where lines wrap and whether a scrollbar is
    // needed at all, and fires no scroll event on the way.
    React.useEffect(() => {
      const node = rootRef.current
      if (node === null) return
      const observer = new ResizeObserver(() => {
        sync()
        placeWash()
      })
      observer.observe(node)
      return () => observer.disconnect()
    }, [sync, placeWash])

    /**
     * A collapsed caret moves without firing `select`, `input` or anything
     * else on the field itself — clicking, arrowing and Home/End are all
     * silent there. `selectionchange` on the document is the one event that
     * covers them, so it is the only reliable way to follow a caret.
     */
    React.useEffect(() => {
      if (!currentLine) return
      const handle = (): void => {
        if (document.activeElement === textareaRef.current) readCaret()
      }
      document.addEventListener("selectionchange", handle)
      return () => document.removeEventListener("selectionchange", handle)
    }, [currentLine, readCaret])

    return (
      <div
        ref={rootRef}
        className={cx("hds-editor", className)}
        data-wrap={wrap || undefined}
        data-numbered={lineNumbers || undefined}
      >
        <div className="hds-editor-body">
          {/* Behind the mirror and hidden until the field has focus: a row
              marked in a pane nobody is typing in is noise, not orientation. */}
          <div className="hds-editor-wash" ref={washRef} aria-hidden="true" hidden />
          {/* `aria-hidden`, and never focusable: to a screen reader this pane
              is the textarea and nothing else. The mirror is a picture. */}
          <pre className="hds-editor-mirror" ref={mirrorRef} aria-hidden="true">
            <code ref={codeRef}>
              {lines.map((runs, index) => (
                <span
                  key={index}
                  className="hds-editor-line"
                  data-mark={marks?.[index] ?? undefined}
                >
                  {runs.map((run, at) => (
                    <span key={at} data-role={run.role ?? undefined}>
                      {run.text}
                    </span>
                  ))}
                </span>
              ))}
            </code>
          </pre>
          <textarea
            ref={setNode}
            className="hds-editor-input"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onScroll={(event) => {
              sync()
              onScroll?.(event)
            }}
            onFocus={() => {
              rootRef.current?.setAttribute("data-focused", "")
              readCaret()
            }}
            onBlur={() => rootRef.current?.removeAttribute("data-focused")}
            aria-label={ariaLabel}
            spellCheck={spellCheck}
            readOnly={readOnly}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
          />
        </div>
      </div>
    )
  }
)
