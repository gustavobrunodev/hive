import type { ComponentPropsWithoutRef, ReactNode } from "react";
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
    sendLabel?: string;
}
/**
 * The chat prompt composer — an auto-resizing `Textarea` + toolbar + send
 * control (disabled while empty/streaming/disabled) + attachment slot,
 * with keyboard submit (spec.md's P3 AC4). Generic per D4: no transport,
 * no model calls — the app owns `onSubmit` and provides `attachments` as
 * already-rendered `Attachment` chips.
 */
export declare function PromptInput({ value: valueProp, defaultValue, onChange, onSubmit, placeholder, disabled, streaming, minRows, maxRows, attachments, toolbar, sendLabel, className, ...rest }: PromptInputProps): import("react").JSX.Element;
