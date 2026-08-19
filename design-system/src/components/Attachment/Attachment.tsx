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
  /**
   * Where a too-long name loses characters. `"end"` is the browser default;
   * `"middle"` keeps the tail — for file names, the extension is the single
   * most informative token, and it is exactly what ellipsis-at-the-end throws
   * away first (`relatorio-final-v3.docx` truncating to `relatorio-fin…`
   * hides both the version and the file type). Only applies to a string
   * `name`; a node is rendered as given.
   */
  truncate?: "end" | "middle"
}

/**
 * Splits a file name so the tail — the extension plus a few characters before
 * it — survives truncation. Extension-aware rather than a fixed character
 * count: `.tar.gz` and a dotless name both have to land somewhere sensible.
 */
function splitAtTail(name: string): [string, string] {
  const dot = name.lastIndexOf(".")
  const extension = dot > 0 && name.length - dot <= 7 ? name.length - dot : 0
  const tail = Math.min(name.length, extension + 3)
  // A short name has nothing to truncate; keeping it whole in the head avoids
  // a split that could wrap between two halves of one word.
  if (name.length <= 12) return [name, ""]
  return [name.slice(0, name.length - tail), name.slice(name.length - tail)]
}

/**
 * A single attachment chip for `PromptInput`'s attachment slot — name +
 * optional meta/icon, with a remove callback (spec.md's P3 AC4/Independent
 * Test: "removing an Attachment fires its callback").
 */
export const Attachment = forwardRef<HTMLDivElement, AttachmentProps>(function Attachment(
  { name, meta, icon, onRemove, removeLabel, truncate = "end", className, ...rest },
  ref
) {
  const label = removeLabel ?? (typeof name === "string" ? `Remove ${name}` : "Remove attachment")
  const middle = truncate === "middle" && typeof name === "string"
  const [head, tail] = middle ? splitAtTail(name) : ["", ""]

  return (
    <div ref={ref} className={cx("hds-attachment", className)} {...rest}>
      {icon && <span className="hds-attachment-icon">{icon}</span>}
      <span className="hds-attachment-text">
        {middle ? (
          <span className="hds-attachment-name" data-truncate="middle">
            <span className="hds-attachment-name-head">{head}</span>
            {tail !== "" && <span className="hds-attachment-name-tail">{tail}</span>}
          </span>
        ) : (
          <span className="hds-attachment-name">{name}</span>
        )}
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
