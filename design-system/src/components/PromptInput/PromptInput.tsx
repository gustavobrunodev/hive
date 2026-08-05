import { useLayoutEffect, useRef } from "react"
import type { ComponentPropsWithoutRef, ReactNode, Ref, UIEvent } from "react"
import { cx } from "../../utils/cx"
import { useControllableState } from "../../hooks/useControllableState"
import { Textarea } from "../Textarea/Textarea"
import "./PromptInput.css"

export interface PromptInputProps extends Omit<ComponentPropsWithoutRef<"div">, "onChange" | "onSubmit"> {
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  /** Called with the trimmed prompt text on submit (Enter or clicking send). Not called when disabled/streaming/empty. */
  onSubmit: (value: string) => void
  placeholder?: string
  /** Disables the whole composer (textarea + send). */
  disabled?: boolean
  /** The assistant is currently generating — disables the send control without disabling the textarea (spec.md's P3 AC4). */
  streaming?: boolean
  minRows?: number
  maxRows?: number
  /** Slot rendering `Attachment` chips above the textarea. */
  attachments?: ReactNode
  /** Slot for extra toolbar controls (e.g. an attach-file trigger), rendered leading the send button. */
  toolbar?: ReactNode
  /**
   * Replaces the toolbar's extra-controls slot and spans the row, for a mode
   * that takes the composer over temporarily (a transport, a confirmation, an
   * inline prompt) while the send control keeps its exact position and
   * behaviour. When set, `toolbar` is not rendered — the two are alternatives,
   * not layers, which is what keeps the row's height and the send button from
   * moving.
   */
  toolbarOverlay?: ReactNode
  /**
   * Emphasis state for the composer frame: an accent ring, for when the app
   * needs the composer to read as *active* rather than merely focused. Purely
   * presentational and orthogonal to focus — a highlighted composer that loses
   * focus stays highlighted.
   */
  highlighted?: boolean
  sendLabel?: string
  /**
   * Interrupt handler for the in-flight response. When provided together with
   * `streaming`, the send control becomes a stop control (same button, same
   * position — the Claude-chat pattern): enabled, labelled `stopLabel`, and
   * clicking it calls `onStop` instead of submitting. Without `onStop`,
   * `streaming` falls back to simply disabling send.
   */
  onStop?: () => void
  /** Accessible label for the stop state of the send control. */
  stopLabel?: string
  /**
   * Lets an empty prompt submit (e.g. when the app has pending attachments
   * that make a text-less send meaningful). `onSubmit` then receives `""`.
   */
  allowEmptySubmit?: boolean
  /**
   * Inline-token highlighter: given the current value, returns the same text
   * with token runs wrapped in styled elements (e.g. `<mark>`). Rendered in a
   * transparent backdrop layer aligned under the textarea, so token
   * backgrounds show through while the textarea keeps owning the glyphs,
   * caret and selection. The returned nodes must preserve the value's exact
   * character sequence — any drift misaligns the backdrop.
   */
  highlight?: (value: string) => ReactNode
  /** Reaches the underlying textarea (caret introspection, imperative focus). */
  textareaRef?: Ref<HTMLTextAreaElement>
}

function SendIcon() {
  return (
    <svg className="hds-prompt-input-icon-send" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function StopIcon() {
  return (
    <svg className="hds-prompt-input-icon-stop" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="3.5" y="3.5" width="9" height="9" rx="1.5" fill="currentColor" />
    </svg>
  )
}

/**
 * The chat prompt composer — an auto-resizing `Textarea` + toolbar + send
 * control (disabled while empty/streaming/disabled) + attachment slot,
 * with keyboard submit (spec.md's P3 AC4). Generic per D4: no transport,
 * no model calls — the app owns `onSubmit` and provides `attachments` as
 * already-rendered `Attachment` chips.
 *
 * `toolbarOverlay` and `highlighted` support an app putting the composer into a
 * temporary mode in place, without a modal and without a layout shift. Both are
 * additive and named for what they do to the composer, not for any one caller's
 * feature.
 */
export function PromptInput({
  value: valueProp,
  defaultValue = "",
  onChange,
  onSubmit,
  placeholder = "Message...",
  disabled = false,
  streaming = false,
  minRows = 1,
  maxRows = 8,
  attachments,
  toolbar,
  toolbarOverlay,
  highlighted = false,
  sendLabel = "Send",
  onStop,
  stopLabel = "Stop",
  allowEmptySubmit = false,
  highlight,
  textareaRef,
  className,
  ...rest
}: PromptInputProps) {
  const [value, setValue] = useControllableState<string>({
    value: valueProp,
    defaultValue,
    onChange,
  })

  const backdropRef = useRef<HTMLDivElement>(null)
  const innerTextareaRef = useRef<HTMLTextAreaElement | null>(null)

  const isEmpty = value.trim().length === 0
  // Stop mode: while streaming with an `onStop` handler, the send control
  // flips into an always-enabled interrupt button (the Claude-chat pattern).
  const stopMode = streaming && onStop !== undefined
  const sendDisabled = disabled || streaming || (isEmpty && !allowEmptySubmit)

  const submit = () => {
    if (sendDisabled) return
    onSubmit(value.trim())
    if (valueProp === undefined) setValue("")
  }

  const setTextareaNode = (node: HTMLTextAreaElement | null) => {
    innerTextareaRef.current = node
    if (typeof textareaRef === "function") {
      textareaRef(node)
    } else if (textareaRef) {
      ;(textareaRef as { current: HTMLTextAreaElement | null }).current = node
    }
  }

  const syncBackdropScroll = () => {
    const backdrop = backdropRef.current
    const textarea = innerTextareaRef.current
    if (backdrop && textarea) backdrop.scrollTop = textarea.scrollTop
  }

  // Autosize can change scrollTop without a scroll event (value edits at
  // maxRows) — re-align the backdrop after every value-driven layout.
  useLayoutEffect(() => {
    if (highlight) syncBackdropScroll()
  })

  const textarea = (
    <Textarea
      ref={setTextareaNode}
      className="hds-prompt-input-textarea"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onSubmit={submit}
      onScroll={highlight ? (event: UIEvent<HTMLTextAreaElement>) => {
        const backdrop = backdropRef.current
        if (backdrop) backdrop.scrollTop = event.currentTarget.scrollTop
      } : undefined}
      placeholder={placeholder}
      disabled={disabled}
      minRows={minRows}
      maxRows={maxRows}
    />
  )

  return (
    <div
      className={cx("hds-prompt-input", className)}
      data-disabled={disabled || undefined}
      data-highlighted={highlighted || undefined}
      {...rest}
    >
      {attachments && <div className="hds-prompt-input-attachments">{attachments}</div>}
      {highlight ? (
        <div className="hds-prompt-input-editor">
          <div ref={backdropRef} className="hds-prompt-input-backdrop" aria-hidden="true">
            {highlight(value)}
          </div>
          {textarea}
        </div>
      ) : (
        textarea
      )}
      <div className="hds-prompt-input-toolbar">
        {toolbarOverlay === undefined ? (
          <div className="hds-prompt-input-toolbar-extra">{toolbar}</div>
        ) : (
          <div className="hds-prompt-input-toolbar-overlay">{toolbarOverlay}</div>
        )}
        <button
          type="button"
          className="hds-prompt-input-send"
          data-mode={stopMode ? "stop" : "send"}
          disabled={stopMode ? disabled : sendDisabled}
          aria-label={stopMode ? stopLabel : sendLabel}
          title={stopMode ? stopLabel : sendLabel}
          onClick={stopMode ? onStop : submit}
        >
          <SendIcon />
          <StopIcon />
        </button>
      </div>
    </div>
  )
}
