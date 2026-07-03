import type { ComponentPropsWithoutRef, ReactNode } from "react";
import "./Input.css";
export interface InputProps extends ComponentPropsWithoutRef<"input"> {
    /** Optional leading icon rendered inside the field, before the text. */
    startIcon?: ReactNode;
    /** Marks the field invalid: drives `aria-invalid` and the danger-tinted visual state. */
    error?: boolean;
}
export declare const Input: import("react").ForwardRefExoticComponent<InputProps & import("react").RefAttributes<HTMLInputElement>>;
