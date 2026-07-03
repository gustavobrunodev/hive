import { forwardRef } from "react"
import type { ComponentPropsWithoutRef, ReactNode } from "react"
import { cx } from "../../utils/cx"
import "./ChatMessage.css"

export type ChatMessageRole = "user" | "assistant" | "system"

export interface ChatMessageProps extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
  /** Who sent the message — drives alignment and tokenized styling. */
  role: ChatMessageRole
  /** Avatar slot (typically an `Avatar`). Omitted for `role="system"`. */
  avatar?: ReactNode
  /** Timestamp slot — a string or any rendered node (e.g. `<time>`). */
  timestamp?: ReactNode
  /** Actions slot (e.g. copy/retry buttons) — shown on hover/focus-within. */
  actions?: ReactNode
  /** The message body. The app supplies already-rendered content (e.g. rendered markdown) — this component does not parse or render markdown itself. */
  children: ReactNode
}

/**
 * A single chat message — role-based alignment (`user` right, `assistant`
 * left, `system` centered/muted) with avatar/content/timestamp/actions
 * slots (spec.md's P3 AC1). Generic per D4: no transport, no model calls,
 * no markdown parsing — the app supplies rendered content via `children`.
 */
export const ChatMessage = forwardRef<HTMLDivElement, ChatMessageProps>(function ChatMessage(
  { role, avatar, timestamp, actions, children, className, ...rest },
  ref
) {
  return (
    <div ref={ref} className={cx("hds-chat-message", `hds-chat-message-${role}`, className)} data-role={role} {...rest}>
      {role !== "system" && avatar && <div className="hds-chat-message-avatar">{avatar}</div>}
      <div className="hds-chat-message-body">
        <div className="hds-chat-message-bubble">{children}</div>
        {(timestamp || actions) && (
          <div className="hds-chat-message-meta">
            {timestamp && <span className="hds-chat-message-timestamp">{timestamp}</span>}
            {actions && <div className="hds-chat-message-actions">{actions}</div>}
          </div>
        )}
      </div>
    </div>
  )
})

ChatMessage.displayName = "ChatMessage"
