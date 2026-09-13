import { type ComponentPropsWithoutRef, type ReactNode } from "react";
import "./CodeFence.css";
export interface CodeFenceProps extends Omit<ComponentPropsWithoutRef<"div">, "children" | "onCopy"> {
    /** The rendered block content — usually a `<code>` element with its highlighted runs. */
    children: ReactNode;
    /**
     * The plain text the copy control puts on the clipboard. Separate from
     * `children` because what is *rendered* is a tree of spans and what is
     * *copied* must be the source, byte for byte: copying `textContent` off the
     * DOM inserts a space at every element boundary, which turns a highlighted
     * line into code that no longer runs.
     */
    code: string;
    /** Language tag shown in the header (`ts`, `bash`, `json`). Omit for an untagged block. */
    language?: string;
    /**
     * Puts `code` on the clipboard. The component owns no clipboard access of
     * its own — the host does, because a desktop shell and a web page reach it
     * by different routes. Omit to render no copy control.
     */
    onCopy?: (code: string) => void;
    /** Accessible name for the copy control. */
    copyLabel?: string;
    /** Accessible name + text shown for ~1.6s after a successful copy. */
    copiedLabel?: string;
}
/**
 * A fenced code block as it appears **inside prose** — an agent's reply, a
 * rendered `.md` — with the control everyone now reaches for without looking:
 * copy, in the top-right corner.
 *
 * ## Why it is neither of the two blocks that already existed
 *
 * `CodeBlock` is the brand register: a hand-lit listing on a fixed near-black
 * plate, sized for a marketing page, copying through `navigator.clipboard`
 * directly. `OutputBlock` is machine output — capped, growable, sometimes
 * empty, sometimes still arriving, often the evidence for a failure.
 *
 * This is the third thing: a block **the document owns**. It is as long as the
 * author made it (no cap — truncating a snippet somebody is about to run is a
 * worse failure than a long block), it sits on the page's own surfaces so a
 * reply reads as one document rather than a strip of foreign plates, and its
 * only affordance is taking the text away.
 *
 * ## The three decisions inside it
 *
 * - **The control rests quiet and arrives on approach.** At rest it is a faint
 *   outline; hover or keyboard focus anywhere in the block brings it up. A
 *   button that is always at full strength competes with the code for the
 *   corner, and one that only exists on `:hover` cannot be reached by keyboard
 *   at all — so the reveal is driven by `:focus-within` too, and the control
 *   keeps its place in the tab order either way.
 * - **It is positioned against the block, not the scroller.** Long lines scroll
 *   sideways inside `pre`; a control parented to that would ride away with
 *   them. The frame is the positioned element and the `pre` scrolls inside it.
 * - **What it copies is `code`, never the DOM.** See that prop.
 *
 * All copy is passed in — the component ships no strings, so the host owns i18n.
 */
export declare function CodeFence({ children, code, language, onCopy, copyLabel, copiedLabel, className, ...rest }: CodeFenceProps): import("react").JSX.Element;
