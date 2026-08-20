import * as React from "react"
import { cx } from "../../utils/cx"
import { Textarea } from "../Textarea/Textarea"
import type { TextareaProps } from "../Textarea/Textarea"
import "./HighlightedTextarea.css"

export interface HighlightedTextareaProps extends Omit<TextareaProps, "defaultValue"> {
  /** Controlled value. Required: a backdrop can only mirror text it is given. */
  value: string
  /**
   * Inline-token highlighter: given the current value, returns the same text
   * as nodes that may carry backgrounds. Rendered into a transparent mirror
   * aligned under the real glyphs, so a run can be tinted without the browser
   * ever losing a native textarea's caret, selection, IME or spellcheck.
   *
   * **It must return the exact same character sequence it was handed.** Any
   * added or dropped character shifts the mirror and the tint drifts off the
   * words it belongs to — the one failure mode this technique has.
   */
  highlight: (value: string) => React.ReactNode
  /**
   * Emphasis the field is *in*, as opposed to merely focused — a live
   * dictation, a running search. Deliberately orthogonal to `:focus-within`
   * and it outranks it: a field that loses focus mid-mode must not flicker its
   * ring off, because the mode is still running.
   */
  active?: boolean
  /**
   * Grow to fill the flex container instead of hugging the text.
   *
   * Autosizing is right for a composer, where the field is one element among
   * many and should not shout. It is wrong for a field that *is* the screen —
   * a transcript being reviewed — where the leftover space below a six-line box
   * reads as an unfinished layout and the reader gets less room than the panel
   * actually has.
   */
  fill?: boolean
}

/**
 * A textarea that can paint behind its own text.
 *
 * The technique — a transparent-text mirror under a transparent-background
 * textarea — already existed inside `PromptInput`, welded to a chat composer
 * with a send button and an attachment rail. This is that mechanism on its own,
 * because the thing that wants it next is not a composer: it is a transcript
 * being written into *while the microphone is open*, where the tint is what
 * tells someone which words just arrived from the model rather than from their
 * keyboard.
 *
 * What it is **not** is a rich-text editor. The user's caret, selection, undo
 * stack, spellcheck and IME are all the platform's, untouched; the highlight is
 * a picture behind them and can never swallow a keystroke. That is the whole
 * reason to prefer this over a `contenteditable`, and it is why the alignment
 * contract above is strict rather than best-effort.
 */
export const HighlightedTextarea = React.forwardRef<
  HTMLTextAreaElement,
  HighlightedTextareaProps
>(function HighlightedTextarea(
  { value, highlight, active = false, fill = false, className, onScroll, ...rest },
  forwardedRef
) {
  const backdropRef = React.useRef<HTMLDivElement>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null)

  const setNode = React.useCallback(
    (node: HTMLTextAreaElement | null) => {
      textareaRef.current = node
      if (typeof forwardedRef === "function") forwardedRef(node)
      else if (forwardedRef) {
        ;(forwardedRef as { current: HTMLTextAreaElement | null }).current = node
      }
    },
    [forwardedRef]
  )

  // Autosizing changes `scrollTop` without ever firing a scroll event (text
  // arriving at `maxRows` does exactly that), and text arriving on its own is
  // this component's normal case rather than an edge one — so the mirror is
  // re-aligned after every value-driven layout, not only on scroll.
  React.useLayoutEffect(() => {
    const backdrop = backdropRef.current
    const textarea = textareaRef.current
    if (backdrop && textarea) backdrop.scrollTop = textarea.scrollTop
  })

  return (
    <div
      className={cx("hds-hl-textarea", className)}
      data-active={active || undefined}
      data-fill={fill || undefined}
    >
      <div ref={backdropRef} className="hds-hl-textarea-backdrop" aria-hidden="true">
        {highlight(value)}
      </div>
      <Textarea
        ref={setNode}
        className="hds-hl-textarea-field"
        value={value}
        onScroll={(event: React.UIEvent<HTMLTextAreaElement>) => {
          const backdrop = backdropRef.current
          if (backdrop) backdrop.scrollTop = event.currentTarget.scrollTop
          onScroll?.(event)
        }}
        {...rest}
      />
    </div>
  )
})

HighlightedTextarea.displayName = "HighlightedTextarea"
