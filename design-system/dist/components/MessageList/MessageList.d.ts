import type { ComponentPropsWithoutRef, ReactNode } from "react";
import "./MessageList.css";
export interface MessageListProps extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
    /** The conversation's messages (typically `ChatMessage` instances). */
    children: ReactNode;
    /** How close to the bottom (px) still counts as "at the bottom" for auto-pin purposes. Defaults to `80`. */
    bottomThreshold?: number;
    /** Label for the floating "jump to latest" button. */
    jumpToLatestLabel?: string;
}
/**
 * Auto-scrolling conversation container — stays pinned to the latest
 * message unless the user has scrolled up, and surfaces a "jump to latest"
 * affordance when unpinned (spec.md's P3 AC3). Built on `ScrollArea`
 * (design.md's Radix -> DS Mapping). Generic per D4: renders whatever
 * `children` the app supplies (typically `ChatMessage` instances) — no
 * message-shape assumptions.
 */
export declare function MessageList({ children, bottomThreshold, jumpToLatestLabel, className, ...rest }: MessageListProps): import("react").JSX.Element;
