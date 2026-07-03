import type { ComponentPropsWithoutRef, ReactNode } from "react";
import "./Attachment.css";
export interface AttachmentProps extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
    /** File/attachment name. */
    name: ReactNode;
    /** Optional secondary text (e.g. file size, type). */
    meta?: ReactNode;
    /** Optional leading icon slot (e.g. a file-type glyph). */
    icon?: ReactNode;
    /** Called when the remove control is activated. Omit to render a non-removable chip. */
    onRemove?: () => void;
    /** Accessible label for the remove control. Defaults to `"Remove {name}"` when `name` is a string, else `"Remove attachment"`. */
    removeLabel?: string;
}
/**
 * A single attachment chip for `PromptInput`'s attachment slot — name +
 * optional meta/icon, with a remove callback (spec.md's P3 AC4/Independent
 * Test: "removing an Attachment fires its callback").
 */
export declare const Attachment: import("react").ForwardRefExoticComponent<AttachmentProps & import("react").RefAttributes<HTMLDivElement>>;
