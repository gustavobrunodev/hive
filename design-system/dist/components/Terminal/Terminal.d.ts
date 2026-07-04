import type { ComponentPropsWithoutRef } from "react";
import "./Terminal.css";
export interface TerminalPhase {
    /** Phase name rendered on its `Chip`. */
    label: string;
    /** Marks this phase as the current one (accent-highlighted `Chip`). */
    active?: boolean;
}
export interface TerminalProps extends ComponentPropsWithoutRef<"div"> {
    /** Text shown right-aligned in the title bar (e.g. a session/window name). */
    title?: string;
    /** Command string rendered after the `›` prompt, with a blinking cursor after it. */
    command?: string;
    /** Optional muted output line rendered below the command. */
    output?: string;
    /** Optional row of phase `Chip`s (workflow steps) rendered below the output. Omit for a plain command/output terminal. */
    phases?: TerminalPhase[];
    /** Clips the terminal's corners with the DS beveled-cut style. Defaults to `true`. */
    cut?: boolean;
}
/**
 * Decorative terminal-window frame: a title bar with three brand-dot
 * traffic-light dots, a command line with blinking cursor, optional output,
 * and an optional row of phase chips. The three dots are intentionally raw
 * (undertoned) brand colors, not semantic role tokens — see this story's
 * usage section.
 */
export declare function Terminal({ title, command, output, phases, cut, className, ...rest }: TerminalProps): import("react").JSX.Element;
