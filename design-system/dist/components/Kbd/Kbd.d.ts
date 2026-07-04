import type { ComponentPropsWithoutRef } from "react";
import "./Kbd.css";
export interface KbdProps extends ComponentPropsWithoutRef<"kbd"> {
}
/**
 * A single keyboard key/label, rendered as a native `<kbd>` styled as a key
 * cap. Represents exactly one key — for a combination (e.g. `Ctrl` `K`),
 * render multiple `Kbd`s side by side with your own separator (`+`) between
 * them; `Kbd` does not model combinations itself.
 */
export declare function Kbd({ className, children, ...rest }: KbdProps): import("react").JSX.Element;
