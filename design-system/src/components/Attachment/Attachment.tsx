import { forwardRef } from "react"
import type { ComponentPropsWithoutRef, ReactNode } from "react"
import { cx } from "../../utils/cx"
import "./Attachment.css"

export interface AttachmentProps extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
  /** File/attachment name. */
  name: ReactNode
  /** Optional secondary text (e.g. file size, type). */
  meta?: ReactNode
  /** Optional leading icon slot (e.g. a file-type glyph). */
  icon?: ReactNode
  /** Called when the remove control is activated. Omit to render a non-removable chip. */
  onRemove?: () => void
  /** Accessible label for the remove control. Defaults to `"Remove {name}"` when `name` is a string, else `"Remove attachment"`. */
  removeLabel?: string
}

/**
 * A single attachment chip for `PromptInput`'s attachment slot — name +
 * optional meta/icon, with a remove callback (spec.md's P3 AC4/Independent
 * Test: "removing an Attachment fires its callback").
 */
export const Attachment = forwardRef<HTMLDivElement, AttachmentProps>(function Attachment(
  { name, meta, icon, onRemove, removeLabel, className, ...rest },
  ref
) {
  const label = removeLabel ?? (typeof name === "string" ? `Remove ${name}` : "Remove attachment")

  return (
    <div ref={ref} className={cx("hds-attachment", className)} {...rest}>
      {icon && <span className="hds-attachment-icon">{icon}</span>}
      <span className="hds-attachment-text">
        <span className="hds-attachment-name">{name}</span>
        {meta && <span className="hds-attachment-meta">{meta}</span>}
      </span>
      {onRemove && (
        <button type="button" className="hds-attachment-remove" aria-label={label} onClick={onRemove}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  )
})

Attachment.displayName = "Attachment"
