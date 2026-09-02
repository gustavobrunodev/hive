import { type ComponentPropsWithoutRef, type ReactNode } from "react";
import "./OutputBlock.css";
/** Semantic treatment of the frame. `danger` is for output that *is* the failure (stderr, a stack trace). */
export type OutputBlockTone = "neutral" | "danger";
export interface OutputBlockProps extends Omit<ComponentPropsWithoutRef<"div">, "children" | "onCopy"> {
    /** The text to show, verbatim. Whitespace is preserved; long lines wrap rather than scroll sideways. */
    text: string;
    /** Small heading above the frame. Omit for an unlabelled block. */
    label?: ReactNode;
    /** Right-aligned fine print in the header — a line count, a duration, an exit code. */
    meta?: ReactNode;
    tone?: OutputBlockTone;
    /**
     * Lines rendered before the block clips itself and offers to grow. `0`
     * disables the cap. Defaults to `12` — about one screenful of a command's
     * answer, past which a transcript stops being readable.
     */
    maxLines?: number;
    /** Label for the grow control, given how many lines are hidden. Required to offer one. */
    moreLabel?: (hidden: number) => string;
    /** Label for the same control once grown. */
    lessLabel?: string;
    /**
     * Renders a leading prompt glyph (`$`, `›`) on the first line, so a command
     * reads as a command. Purely presentational — it is never part of `text`,
     * and never part of what {@link onCopy} receives.
     */
    prompt?: string;
    /** Shows a copy control. Omit to render none — this component owns no clipboard access of its own. */
    onCopy?: (text: string) => void;
    copyLabel?: string;
    /** Shown on the copy control for ~1.6s after it is used. */
    copiedLabel?: string;
    /** Standing note under the frame: a truncation warning, a source. */
    note?: ReactNode;
    /** What to say when `text` is empty — the difference between "returned nothing" and "nothing captured". */
    emptyLabel?: ReactNode;
    /**
     * The result has not arrived yet: renders shimmer bars in place of the text
     * and marks the region busy. A skeleton, not a spinner — the frame is
     * already on screen and only its content is missing.
     */
    pending?: boolean;
}
/**
 * A framed block of machine output — a command's answer, a tool result, a log
 * excerpt — with the four things such a block always ends up needing: a cap
 * that grows in place, a copy control, a truncation note, and a failure tone.
 *
 * ## Why it is not `CodeBlock`
 *
 * `CodeBlock` is for authored code in prose: it is uncapped, its highlighting
 * is hand-wrapped spans, and its copy button floats over the corner. This is
 * for text a machine produced and nobody curated — arbitrarily long, sometimes
 * empty, sometimes still arriving, and often the evidence for a failure. Those
 * are different problems, and solving them in `CodeBlock` would have made the
 * common case worse.
 *
 * Long lines wrap (`overflow-wrap: anywhere`) rather than scrolling sideways:
 * a horizontal scrollbar inside a vertical transcript is a place text goes to
 * be missed, and machine output has no meaningful line geometry to preserve.
 *
 * All copy is passed in — the component ships no strings, so the host owns
 * i18n.
 */
export declare function OutputBlock({ text, label, meta, tone, maxLines, moreLabel, lessLabel, prompt, onCopy, copyLabel, copiedLabel, note, emptyLabel, pending, className, ...rest }: OutputBlockProps): import("react").JSX.Element;
