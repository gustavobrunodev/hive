import type { ComponentPropsWithoutRef, ReactNode, Ref } from "react";
import "./PromptInput.css";
export interface PromptInputProps extends Omit<ComponentPropsWithoutRef<"div">, "onChange" | "onSubmit"> {
    value?: string;
    defaultValue?: string;
    onChange?: (value: string) => void;
    /** Called with the trimmed prompt text on submit (Enter or clicking send). Not called when disabled/streaming/empty. */
    onSubmit: (value: string) => void;
    placeholder?: string;
    /** Disables the whole composer (textarea + send). */
    disabled?: boolean;
    /** The assistant is currently generating — disables the send control without disabling the textarea (spec.md's P3 AC4). */
    streaming?: boolean;
    minRows?: number;
    maxRows?: number;
    /** Slot rendering `Attachment` chips above the textarea. */
    attachments?: ReactNode;
    /** Slot for extra toolbar controls (e.g. an attach-file trigger), rendered leading the send button. */
    toolbar?: ReactNode;
    /**
     * Replaces the toolbar's extra-controls slot and spans the row, for a mode
     * that takes the composer over temporarily (a transport, a confirmation, an
     * inline prompt) while the send control keeps its exact position and
     * behaviour. When set, `toolbar` is not rendered — the two are alternatives,
     * not layers, which is what keeps the row's height and the send button from
     * moving.
     */
    toolbarOverlay?: ReactNode;
    /**
     * Emphasis state for the composer frame: an accent ring, for when the app
     * needs the composer to read as *active* rather than merely focused. Purely
     * presentational and orthogonal to focus — a highlighted composer that loses
     * focus stays highlighted.
     */
    highlighted?: boolean;
    sendLabel?: string;
    /**
     * Interrupt handler for the in-flight response. When provided together with
     * `streaming`, the send control becomes a stop control (same button, same
     * position — the Claude-chat pattern): enabled, labelled `stopLabel`, and
     * clicking it calls `onStop` instead of submitting. Without `onStop`,
     * `streaming` falls back to simply disabling send.
     */
    onStop?: () => void;
    /** Accessible label for the stop state of the send control. */
    stopLabel?: string;
    /**
     * Lets an empty prompt submit (e.g. when the app has pending attachments
     * that make a text-less send meaningful). `onSubmit` then receives `""`.
     */
    allowEmptySubmit?: boolean;
    /**
     * Inline-token highlighter: given the current value, returns the same text
     * with token runs wrapped in styled elements (e.g. `<mark>`). Rendered in a
     * transparent backdrop layer aligned under the textarea, so token
     * backgrounds show through while the textarea keeps owning the glyphs,
     * caret and selection. The returned nodes must preserve the value's exact
     * character sequence — any drift misaligns the backdrop.
     */
    highlight?: (value: string) => ReactNode;
    /** Reaches the underlying textarea (caret introspection, imperative focus). */
    textareaRef?: Ref<HTMLTextAreaElement>;
}
/**
 * The chat prompt composer — an auto-resizing `Textarea` + toolbar + send
 * control (disabled while empty/streaming/disabled) + attachment slot,
 * with keyboard submit (spec.md's P3 AC4). Generic per D4: no transport,
 * no model calls — the app owns `onSubmit` and provides `attachments` as
 * already-rendered `Attachment` chips.
 *
 * `toolbarOverlay` and `highlighted` support an app putting the composer into a
 * temporary mode in place, without a modal and without a layout shift. Both are
 * additive and named for what they do to the composer, not for any one caller's
 * feature.
 */
export declare function PromptInput({ value: valueProp, defaultValue, onChange, onSubmit, placeholder, disabled, streaming, minRows, maxRows, attachments, toolbar, toolbarOverlay, highlighted, sendLabel, onStop, stopLabel, allowEmptySubmit, highlight, textareaRef, className, ...rest }: PromptInputProps): import("react").JSX.Element;
