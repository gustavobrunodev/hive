import * as React from "react";
import { type CodeLanguage } from "./syntax";
import "./CodeEditor.css";
/**
 * A per-line change mark, drawn as a bar in the number column. The vocabulary
 * is git's, but the component knows nothing about git — a caller hands it an
 * array as long as the file's lines, and it paints what it is given.
 */
export type CodeChangeMark = "add" | "modified" | "deleted";
export interface CodeEditorProps {
    /** Controlled source. Required: a mirror can only paint text it is given. */
    value: string;
    onChange: (value: string) => void;
    /**
     * The file being edited. The grammar is read off its name, so the caller
     * never has to keep an extension table of its own — and a file type nobody
     * mapped falls back to plain ink rather than to a wrong colouring.
     */
    filename?: string;
    /** Overrides the grammar `filename` would have chosen. */
    language?: CodeLanguage | null;
    /** Accessible name — the surface has no visible label of its own. */
    ariaLabel: string;
    readOnly?: boolean;
    spellCheck?: boolean;
    /**
     * Soft-wrap long lines (the default). Off gives a horizontally scrolling
     * surface where source line *n* is always exactly one screen row.
     */
    wrap?: boolean;
    /** The numbered column at the left (default on). */
    lineNumbers?: boolean;
    /**
     * A wash on the row the caret is in, while the field has focus (default on).
     * Off for a read-only surface, where there is no caret to follow.
     */
    currentLine?: boolean;
    /**
     * One entry per source line — `null` for an unchanged line. Shorter arrays
     * simply leave the rest of the file unmarked, so a caller can hand over a
     * stale array mid-keystroke without the marks jumping.
     */
    marks?: ReadonlyArray<CodeChangeMark | null>;
    className?: string;
    onScroll?: (event: React.UIEvent<HTMLTextAreaElement>) => void;
}
/**
 * A text editor that paints its own syntax.
 *
 * ## Why this and not a plain textarea
 *
 * Because an editor with one ink for every character makes the reader do the
 * parser's job. Structure that a colour would have handed over in a glance —
 * where the string ends, which word is the key and which is the value, that
 * this line is a comment and not code — has to be re-derived character by
 * character instead. Every IDE has answered this the same way for thirty
 * years, and a file editor that does not is the "wrapped terminal" this
 * product's own anti-references warn against.
 *
 * ## Why this and not a code-editor library
 *
 * Because the platform already ships the hard parts. CodeMirror and Monaco
 * replace the browser's text field with a simulated one, and inherit the whole
 * job of re-implementing the caret, the selection, undo, IME, spellcheck,
 * accessibility and native find — for a pane whose job is "let me fix this
 * line in a markdown file". Here the real `<textarea>` stays exactly where it
 * was, on top, with transparent glyphs; a `<pre>` behind it renders the same
 * characters in colour, and the two are held in alignment by sharing every
 * metric that affects layout. Nothing can swallow a keystroke, because nothing
 * is between the user and the field.
 *
 * The one strict contract that technique has is documented on `CodeRun`: the
 * mirror must reproduce the source character for character. It does; the
 * grammar tests hold it to that.
 *
 * ## Why the mirror is one block per line
 *
 * Because everything an IDE puts *beside* a line — its number, its change bar,
 * the wash under the caret — has to know where that line ends up on screen,
 * and a line that soft-wraps is three rows tall. A parallel column of
 * fixed-height cells can only be right while nothing wraps, which is why the
 * gutter used to force wrapping off and leave prose running off the right edge
 * of a narrow pane. With one block per source line the browser answers the
 * question for us: the number is positioned against its own line's box, so it
 * is correct at every width, for free.
 */
export declare const CodeEditor: React.ForwardRefExoticComponent<CodeEditorProps & React.RefAttributes<HTMLTextAreaElement>>;
