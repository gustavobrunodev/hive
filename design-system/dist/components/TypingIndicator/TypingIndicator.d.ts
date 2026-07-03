import type { ComponentPropsWithoutRef } from "react";
import "./TypingIndicator.css";
export interface TypingIndicatorProps extends Omit<ComponentPropsWithoutRef<"span">, "children"> {
    /** Accessible status text, rendered via `VisuallyHidden`. Defaults to `"Assistant is responding"`. */
    label?: string;
}
/**
 * Three-dot "assistant is typing" indicator — `role="status"` announces
 * `label` to screen readers (spec.md's P3 AC2); the bounce animation
 * collapses to a static state under `prefers-reduced-motion`.
 */
export declare function TypingIndicator({ label, className, ...rest }: TypingIndicatorProps): import("react").JSX.Element;
