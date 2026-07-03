import type { ComponentPropsWithoutRef, ReactElement, ReactNode } from "react";
import "./Field.css";
export interface FieldProps extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
    /** Field label text, rendered via `Label` and wired to the control via `htmlFor`/`id`. */
    label: ReactNode;
    /** Optional helper text, always visible, associated via `aria-describedby`. */
    description?: ReactNode;
    /** Error message. When present, sets `aria-invalid` on the control and is announced via `role="alert"`. */
    error?: ReactNode;
    /** Marks the field required — forwarded to `Label` and to the control's `aria-required`. */
    required?: boolean;
    /** A single form control element (e.g. `<Input />`, `<Textarea />`) — receives `id`/`aria-describedby`/`aria-invalid`/`aria-required`. */
    children: ReactElement<{
        id?: string;
        "aria-describedby"?: string;
        "aria-invalid"?: boolean | "true" | "false";
        "aria-required"?: boolean;
    }>;
}
/**
 * Composes `Label` + a single form control + optional description/error,
 * wiring the full accessible association (`htmlFor`/`id`/`aria-describedby`/
 * `aria-invalid`) so consumers don't hand-roll it per field (spec.md's P1
 * "Accessible form controls" AC2).
 */
export declare function Field({ label, description, error, required, className, children, ...rest }: FieldProps): import("react").JSX.Element;
