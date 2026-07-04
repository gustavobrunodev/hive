import type { ComponentPropsWithoutRef } from "react"
import { useRef, useState } from "react"
import { cx } from "../../utils/cx"
import "./CodeBlock.css"

export interface CorProps extends ComponentPropsWithoutRef<"span"> {}

/** Inline accent-colored span for highlighting a keyword/identifier within `CodeBlock`'s `<pre>` content. */
export function Cor({ children }: CorProps) {
  return <span className="hds-code-cor">{children}</span>
}

export interface CmtProps extends ComponentPropsWithoutRef<"span"> {}

/** Inline muted span for a code-comment-style annotation within `CodeBlock`'s `<pre>` content. */
export function Cmt({ children }: CmtProps) {
  return <span className="hds-code-cmt">{children}</span>
}

export interface CodeBlockProps extends ComponentPropsWithoutRef<"div"> {
  /** Plain-text string copied to the clipboard when the copy button is clicked. Omit to make the button a no-op (copies an empty string). */
  copyText?: string
  /** Label shown on the copy button in its idle state. Defaults to `"Copiar"`. */
  copyLabel?: string
  /** Label shown on the copy button for ~1.6s after a successful copy. Defaults to `"Copiado"`. */
  copiedLabel?: string
}

/**
 * Framed `<pre>` block with a copy-to-clipboard button. Syntax "highlighting"
 * is manual — wrap the parts you want colored in `Cor`/`Cmt` spans inside
 * `children`; there's no language parser/tokenizer.
 */
export function CodeBlock({
  copyText,
  copyLabel = "Copiar",
  copiedLabel = "Copiado",
  className,
  children,
  ...rest
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleCopy() {
    navigator.clipboard
      .writeText(copyText ?? "")
      .then(() => {
        setCopied(true)
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => setCopied(false), 1600)
      })
      .catch(() => {})
  }

  return (
    <div className={cx("hds-code", className)} {...rest}>
      <button
        type="button"
        className={cx("hds-copy", copied && "hds-copy-ok")}
        onClick={handleCopy}
        data-copy={copyText}
      >
        {copied ? copiedLabel : copyLabel}
      </button>
      <pre>{children}</pre>
    </div>
  )
}
