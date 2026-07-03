import type { ComponentPropsWithoutRef, ReactNode } from "react";
import "./ChatMessage.css";
export type ChatMessageRole = "user" | "assistant" | "system";
export interface ChatMessageProps extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
    /** Who sent the message — drives alignment and tokenized styling. */
    role: ChatMessageRole;
    /** Avatar slot (typically an `Avatar`). Omitted for `role="system"`. */
    avatar?: ReactNode;
    /** Timestamp slot — a string or any rendered node (e.g. `<time>`). */
    timestamp?: ReactNode;
    /** Actions slot (e.g. copy/retry buttons) — shown on hover/focus-within. */
    actions?: ReactNode;
    /** The message body. The app supplies already-rendered content (e.g. rendered markdown) — this component does not parse or render markdown itself. */
    children: ReactNode;
}
/**
 * A single chat message — role-based alignment (`user` right, `assistant`
 * left, `system` centered/muted) with avatar/content/timestamp/actions
 * slots (spec.md's P3 AC1). Generic per D4: no transport, no model calls,
 * no markdown parsing — the app supplies rendered content via `children`.
 */
export declare const ChatMessage: import("react").ForwardRefExoticComponent<ChatMessageProps & import("react").RefAttributes<HTMLDivElement>>;
