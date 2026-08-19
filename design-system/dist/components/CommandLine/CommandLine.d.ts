import type { ComponentPropsWithoutRef } from "react";
import "./CommandLine.css";
/**
 * `onCopy` is deliberately taken over from the DOM's clipboard-event handler
 * of the same name: on this component the copy control is the only copy that
 * matters, and a prop that quietly meant the DOM event would be the more
 * surprising of the two. The `Omit` turns any such use into a type error
 * rather than a silent no-op.
 */
export interface CommandLineProps extends Omit<ComponentPropsWithoutRef<"div">, "onCopy"> {
    /** The command itself, verbatim. Rendered as machine text and copied as-is. */
    command: string;
    /**
     * The shell's prompt sigil, drawn before the command (`$`, `%`, `PS>`,
     * `C:\>`). Decorative and unselectable, so copying by hand never picks it up.
     */
    prompt?: string;
    /**
     * Shows the copy control and receives `command` when it is pressed. Omitted
     * means no control at all — the host app owns the clipboard, because an
     * Electron renderer's `navigator.clipboard` is not always granted.
     */
    onCopy?: (command: string) => void;
    copyLabel?: string;
    copiedLabel?: string;
    /**
     * `wrap` (default) folds a long command onto more lines — right for a narrow
     * panel. `scroll` keeps it on one line inside its own horizontal scroller,
     * so the page itself never scrolls sideways.
     */
    overflow?: "wrap" | "scroll";
}
/**
 * One command line, shown as evidence: the exact string a process is spawned
 * with, in a sunken monospace strip with an optional copy control.
 *
 * Different job from `CodeBlock`, which is the brand register's framed sample
 * of illustrative code. This is a product-register receipt — small, tokenized
 * for both themes, and sized to sit inside a settings panel where a claim has
 * just been made and the reader is entitled to check it.
 */
export declare function CommandLine({ command, prompt, onCopy, copyLabel, copiedLabel, overflow, className, ...rest }: CommandLineProps): import("react").JSX.Element;
