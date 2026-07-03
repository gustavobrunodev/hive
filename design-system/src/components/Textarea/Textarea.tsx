import { forwardRef, useMemo } from "react"
import type { ChangeEvent, ComponentPropsWithoutRef, KeyboardEvent, Ref, RefCallback } from "react"
import { cx } from "../../utils/cx"
import { useAutosizeTextarea } from "../../hooks/useAutosizeTextarea"
import { useControllableState } from "../../hooks/useControllableState"
import "./Textarea.css"

export interface TextareaProps
  extends Omit<ComponentPropsWithoutRef<"textarea">, "rows" | "value" | "defaultValue"> {
  /** Minimum visible rows the textarea autosizes down to. Default `1`. */
  minRows?: number
  /** Maximum visible rows the textarea autosizes up to before scrolling. Default `8`. */
  maxRows?: number
  /** Marks the field invalid: drives `aria-invalid` and the danger-tinted visual state. */
  error?: boolean
  /**
   * Fired when the user presses `Enter` (without `Shift`) while
   * `submitOnEnter` is truthy. `Shift+Enter` always inserts a newline and
   * never submits — that split is the universal chat-composer convention
   * and isn't configurable.
   */
  onSubmit?: () => void
  /** Whether bare `Enter` fires `onSubmit`. Defaults to `true` whenever `onSubmit` is passed. */
  submitOnEnter?: boolean
  /** Controlled value. Omit (use `defaultValue` instead) to run uncontrolled. */
  value?: string
  /** Initial value for uncontrolled usage. */
  defaultValue?: string
}

/**
 * Merges any number of refs (callback or object) into a single ref
 * callback, so the internally-needed autosize ref and a caller's
 * forwarded ref can both observe the same node.
 */
function mergeRefs<T>(...refs: Array<Ref<T> | undefined>): RefCallback<T> {
  return (node) => {
    for (const ref of refs) {
      if (!ref) continue
      if (typeof ref === "function") {
        ref(node)
      } else {
        ;(ref as { current: T | null }).current = node
      }
    }
  }
}

/**
 * Product-register autosizing textarea. Consumes role tokens only
 * (DESIGN.md's Inputs/Fields section).
 *
 * Value-tracking judgment call: `useAutosizeTextarea` needs the *current
 * string value* on every render to know when to re-measure, but this
 * component must work both controlled (`value`/`onChange` supplied) and
 * uncontrolled (`defaultValue` or nothing supplied). Rather than reading
 * `.value` off the DOM node imperatively, this always renders the
 * `<textarea>` as controlled internally, backed by `useControllableState`
 * (already built in Phase 0): when a caller passes `value`, that prop is
 * the single source of truth; otherwise an internal state mirror (seeded
 * from `defaultValue`) tracks it. Either way there is always a single
 * definitive string to feed the autosize hook, and callers never see a
 * React "changing an uncontrolled input to controlled" warning.
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    minRows = 1,
    maxRows = 8,
    error = false,
    onSubmit,
    submitOnEnter = true,
    className,
    value,
    defaultValue,
    onChange,
    onKeyDown,
    ...rest
  },
  forwardedRef
) {
  const [currentValue, setCurrentValue] = useControllableState<string>({
    value,
    defaultValue: defaultValue ?? "",
  })

  const autosizeRef = useAutosizeTextarea(currentValue, { minRows, maxRows })
  const ref = useMemo(() => mergeRefs(forwardedRef, autosizeRef), [forwardedRef, autosizeRef])

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setCurrentValue(event.target.value)
    onChange?.(event)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    onKeyDown?.(event)
    if (
      onSubmit &&
      submitOnEnter &&
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault()
      onSubmit()
    }
  }

  return (
    <textarea
      ref={ref}
      className={cx("hds-textarea", error && "hds-textarea-error", className)}
      value={currentValue}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      aria-invalid={error ? "true" : undefined}
      rows={minRows}
      {...rest}
    />
  )
})

Textarea.displayName = "Textarea"
