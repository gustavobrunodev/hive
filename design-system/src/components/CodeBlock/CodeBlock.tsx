import type { ComponentPropsWithoutRef } from "react"
import { useRef, useState } from "react"
import { cx } from "../../utils/cx"
import "./CodeBlock.css"

export interface CorProps extends ComponentPropsWithoutRef<"span"> {}

export function Cor({ children }: CorProps) {
  return <span className="hds-code-cor">{children}</span>
}

export interface CmtProps extends ComponentPropsWithoutRef<"span"> {}

export function Cmt({ children }: CmtProps) {
  return <span className="hds-code-cmt">{children}</span>
}

export interface CodeBlockProps extends ComponentPropsWithoutRef<"div"> {
  copyText?: string
  copyLabel?: string
  copiedLabel?: string
}

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
