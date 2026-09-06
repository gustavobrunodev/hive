import type { ComponentPropsWithoutRef, ReactNode } from "react";
import "./MessageToken.css";
export type MessageTokenKind = "command" | "file";
export interface MessageTokenProps extends ComponentPropsWithoutRef<"mark"> {
    /**
     * What the run of text claims to be. `"command"` — this names something
     * runnable; `"file"` — this names something that exists on disk. Two
     * different claims, so they are drawn differently rather than sharing one
     * generic pill.
     */
    kind: MessageTokenKind;
    /** Replaces the leading glyph. `"command"` draws a slash by default; `"file"` draws none, so pass a file-type icon here. */
    icon?: ReactNode;
    children: ReactNode;
}
/**
 * A marked run inside a chat message: the part of a sentence that names a
 * command or a file, drawn as a token so it reads as a reference rather than
 * as prose — while the message around it stays an ordinary message.
 *
 * ## Why this is a `<mark>` and not a chip
 *
 * The alternative is to promote the whole message into a special "invocation"
 * object with its own anatomy. That hides which half of the message the user
 * actually wrote, breaks the rhythm of the transcript, and forces the command
 * name to compete for width with the sentence — in practice it is the *name*
 * that ends up truncated, which is the one part that must survive. A `<mark>`
 * keeps the message a message: same bubble, same alignment, same selection and
 * copy behaviour, with the reference highlighted in place.
 *
 * ## Two grounds, one component
 *
 * Inside a filled bubble (`ChatMessage role="user"`) the token washes the fill
 * with white and inherits the bubble's ink, which keeps the pair above the AA
 * floor — tinting it with a *colour* is what puts dark ink on a darkened accent
 * and drops it under 4.5:1. Everywhere else it sits on the neutral plate. The
 * component reads its ground from the message it is in, so no caller has to
 * pass it.
 *
 * A command never breaks across lines (the name is one identifier); a file
 * reference does, because a path can legitimately be longer than the bubble.
 */
export declare function MessageToken({ kind, icon, className, children, ...rest }: MessageTokenProps): import("react").JSX.Element;
