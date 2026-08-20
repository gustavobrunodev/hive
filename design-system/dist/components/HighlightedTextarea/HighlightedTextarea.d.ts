import * as React from "react";
import type { TextareaProps } from "../Textarea/Textarea";
import "./HighlightedTextarea.css";
export interface HighlightedTextareaProps extends Omit<TextareaProps, "defaultValue"> {
    /** Controlled value. Required: a backdrop can only mirror text it is given. */
    value: string;
    /**
     * Inline-token highlighter: given the current value, returns the same text
     * as nodes that may carry backgrounds. Rendered into a transparent mirror
     * aligned under the real glyphs, so a run can be tinted without the browser
     * ever losing a native textarea's caret, selection, IME or spellcheck.
     *
     * **It must return the exact same character sequence it was handed.** Any
     * added or dropped character shifts the mirror and the tint drifts off the
     * words it belongs to — the one failure mode this technique has.
     */
    highlight: (value: string) => React.ReactNode;
    /**
     * Emphasis the field is *in*, as opposed to merely focused — a live
     * dictation, a running search. Deliberately orthogonal to `:focus-within`
     * and it outranks it: a field that loses focus mid-mode must not flicker its
     * ring off, because the mode is still running.
     */
    active?: boolean;
    /**
     * Grow to fill the flex container instead of hugging the text.
     *
     * Autosizing is right for a composer, where the field is one element among
     * many and should not shout. It is wrong for a field that *is* the screen —
     * a transcript being reviewed — where the leftover space below a six-line box
     * reads as an unfinished layout and the reader gets less room than the panel
     * actually has.
     */
    fill?: boolean;
}
/**
 * A textarea that can paint behind its own text.
 *
 * The technique — a transparent-text mirror under a transparent-background
 * textarea — already existed inside `PromptInput`, welded to a chat composer
 * with a send button and an attachment rail. This is that mechanism on its own,
 * because the thing that wants it next is not a composer: it is a transcript
 * being written into *while the microphone is open*, where the tint is what
 * tells someone which words just arrived from the model rather than from their
 * keyboard.
 *
 * What it is **not** is a rich-text editor. The user's caret, selection, undo
 * stack, spellcheck and IME are all the platform's, untouched; the highlight is
 * a picture behind them and can never swallow a keystroke. That is the whole
 * reason to prefer this over a `contenteditable`, and it is why the alignment
 * contract above is strict rather than best-effort.
 */
export declare const HighlightedTextarea: React.ForwardRefExoticComponent<HighlightedTextareaProps & React.RefAttributes<HTMLTextAreaElement>>;
