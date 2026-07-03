import type { ComponentPropsWithoutRef, ReactNode } from "react"
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
  sendLabel?: string
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 8h11M8 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * The chat prompt composer — an auto-resizing `Textarea` + toolbar + send
 * control (disabled while empty/streaming/disabled) + attachment slot,
 * with keyboard submit (spec.md's P3 AC4). Generic per D4: no transport,
 * no model calls — the app owns `onSubmit` and provides `attachments` as
 * already-rendered `Attachment` chips.
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
  sendLabel = "Send",
  className,
  ...rest
}: PromptInputProps) {
  const [value, setValue] = useControllableState<string>({
    value: valueProp,
    defaultValue,
    onChange,
  })

  const isEmpty = value.trim().length === 0
  const sendDisabled = disabled || streaming || isEmpty

  const submit = () => {
    if (sendDisabled) return
    onSubmit(value.trim())
    if (valueProp === undefined) setValue("")
  }

  return (
    <div className={cx("hds-prompt-input", className)} data-disabled={disabled || undefined} {...rest}>
      {attachments && <div className="hds-prompt-input-attachments">{attachments}</div>}
      <Textarea
        className="hds-prompt-input-textarea"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onSubmit={submit}
        placeholder={placeholder}
        disabled={disabled}
        minRows={minRows}
        maxRows={maxRows}
      />
      <div className="hds-prompt-input-toolbar">
        <div className="hds-prompt-input-toolbar-extra">{toolbar}</div>
        <button
          type="button"
          className="hds-prompt-input-send"
          disabled={sendDisabled}
          aria-label={sendLabel}
          onClick={submit}
        >
          <SendIcon />
        </button>
      </div>
    </div>
  )
}
