import type { ComponentPropsWithoutRef } from "react";
import "./CodeBlock.css";
export interface CorProps extends ComponentPropsWithoutRef<"span"> {
}
/** Inline accent-colored span for highlighting a keyword/identifier within `CodeBlock`'s `<pre>` content. */
export declare function Cor({ children }: CorProps): import("react").JSX.Element;
export interface CmtProps extends ComponentPropsWithoutRef<"span"> {
}
/** Inline muted span for a code-comment-style annotation within `CodeBlock`'s `<pre>` content. */
export declare function Cmt({ children }: CmtProps): import("react").JSX.Element;
export interface CodeBlockProps extends ComponentPropsWithoutRef<"div"> {
    /** Plain-text string copied to the clipboard when the copy button is clicked. Omit to make the button a no-op (copies an empty string). */
    copyText?: string;
    /** Label shown on the copy button in its idle state. Defaults to `"Copiar"`. */
    copyLabel?: string;
    /** Label shown on the copy button for ~1.6s after a successful copy. Defaults to `"Copiado"`. */
    copiedLabel?: string;
}
/**
 * Framed `<pre>` block with a copy-to-clipboard button. Syntax "highlighting"
 * is manual — wrap the parts you want colored in `Cor`/`Cmt` spans inside
 * `children`; there's no language parser/tokenizer.
 */
export declare function CodeBlock({ copyText, copyLabel, copiedLabel, className, children, ...rest }: CodeBlockProps): import("react").JSX.Element;
