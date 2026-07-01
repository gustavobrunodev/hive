import React, { useRef, useState } from "react";
import { cx } from "../../utils/cx.js";
import "./CodeBlock.css";

export function Cor({ children }) {
  return <span className="hds-code-cor">{children}</span>;
}

export function Cmt({ children }) {
  return <span className="hds-code-cmt">{children}</span>;
}

export function CodeBlock({
  copyText,
  copyLabel = "Copiar",
  copiedLabel = "Copiado",
  className,
  children,
  ...rest
}) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef(null);

  function handleCopy() {
    navigator.clipboard
      .writeText(copyText)
      .then(() => {
        setCopied(true);
        clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setCopied(false), 1600);
      })
      .catch(() => {});
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
  );
}
