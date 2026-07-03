import React from "react";
import "./Label.css";
export type LabelProps = {
    /** Marks the associated control as required and renders a visual + accessible indicator. */
    required?: boolean;
} & React.ComponentPropsWithoutRef<"label">;
/**
 * Thin, styleable wrapper over the native `<label>`. Pairs with a form
 * control via `htmlFor`/`id` (the full label/description/error wiring lives
 * in the `Field` composite, which composes this component).
 */
export declare function Label({ required, className, children, ...rest }: LabelProps): React.JSX.Element;
