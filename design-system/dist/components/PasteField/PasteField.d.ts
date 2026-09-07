import { type ReactNode } from "react";
import "./PasteField.css";
export interface PasteFieldProps {
    /** Field label. Required: a lone box asks for something without saying what. */
    label: ReactNode;
    /** One line under the label — where the value comes from, what it looks like. */
    description?: ReactNode;
    value: string;
    onValueChange: (value: string) => void;
    /** Commit. Fired by the button, by Enter, and (with {@link submitOnPaste}) by a successful paste. */
    onSubmit?: (value: string) => void;
    submitLabel?: ReactNode;
    /**
     * Reads the value from wherever the user copied it — a clipboard, a file, a
     * device. Returning `null` (or throwing) leaves the field untouched: the
     * user can still type, which is exactly what a refused clipboard must not
     * take away. Omit to render no paste control at all; this component owns no
     * clipboard access of its own.
     */
    onPaste?: () => Promise<string | null> | string | null;
    pasteLabel?: ReactNode;
    /** Commits straight after a paste that produced something. */
    submitOnPaste?: boolean;
    /** What went wrong with the value already submitted — announced, and it tints the field. */
    error?: ReactNode;
    /** A submitted value is being checked: the controls lock and the field says so. */
    busy?: boolean;
    placeholder?: string;
    autoFocus?: boolean;
    className?: string;
}
/**
 * A one-line field for a value the user **copied from somewhere else**: a
 * verification code, a token, an invite, an id.
 *
 * ## Why it is not an `Input` in a `Field`
 *
 * Because the gesture is not typing. The value is already on the clipboard —
 * the user just came back from a browser tab holding it — and every step
 * between that and "connected" is a step where the flow can be dropped. So the
 * paste is a control of its own, sitting inside the field, and it can commit
 * in the same click.
 *
 * The three states that follow from that are the whole component:
 *
 *  - **Empty**: the paste control is the primary thing on the row, because it
 *    is what the user is actually going to do. Typing still works — a clipboard
 *    can be refused by the platform, and a dead end there is unforgivable.
 *  - **Busy**: the value went somewhere and nobody has answered yet. Controls
 *    lock rather than disappear, so the field doesn't change size under the
 *    cursor.
 *  - **Rejected**: the message sits under the field, the value stays put, and
 *    the field keeps focus — a wrong paste is a retry, not a restart.
 *
 * Fully controlled: it holds no value of its own, so the surface that owns the
 * flow can clear it, prefill it, or keep it across a re-render.
 */
export declare function PasteField({ label, description, value, onValueChange, onSubmit, submitLabel, onPaste, pasteLabel, submitOnPaste, error, busy, placeholder, autoFocus, className }: PasteFieldProps): import("react").JSX.Element;
