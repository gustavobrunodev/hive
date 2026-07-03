import { useCallback, useEffect, useRef, useState } from "react"
import type { ComponentPropsWithoutRef, ReactNode } from "react"
import { cx } from "../../utils/cx"
import { ScrollArea } from "../ScrollArea/ScrollArea"
import "./MessageList.css"

export interface MessageListProps extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
  /** The conversation's messages (typically `ChatMessage` instances). */
  children: ReactNode
  /** How close to the bottom (px) still counts as "at the bottom" for auto-pin purposes. Defaults to `80`. */
  bottomThreshold?: number
  /** Label for the floating "jump to latest" button. */
  jumpToLatestLabel?: string
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/**
 * Auto-scrolling conversation container — stays pinned to the latest
 * message unless the user has scrolled up, and surfaces a "jump to latest"
 * affordance when unpinned (spec.md's P3 AC3). Built on `ScrollArea`
 * (design.md's Radix -> DS Mapping). Generic per D4: renders whatever
 * `children` the app supplies (typically `ChatMessage` instances) — no
 * message-shape assumptions.
 */
export function MessageList({
  children,
  bottomThreshold = 80,
  jumpToLatestLabel = "Jump to latest",
  className,
  ...rest
}: MessageListProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const [isPinned, setIsPinned] = useState(true)
  const isPinnedRef = useRef(isPinned)
  isPinnedRef.current = isPinned

  const isNearBottom = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport) return true
    const distance = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
    return distance <= bottomThreshold
  }, [bottomThreshold])

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const viewport = viewportRef.current
    if (!viewport) return
    if (typeof viewport.scrollTo === "function") {
      viewport.scrollTo({
        top: viewport.scrollHeight,
        behavior: prefersReducedMotion() ? "instant" : behavior,
      })
    } else {
      // jsdom doesn't implement Element.prototype.scrollTo.
      viewport.scrollTop = viewport.scrollHeight
    }
  }, [])

  const handleScroll = useCallback(() => {
    setIsPinned(isNearBottom())
  }, [isNearBottom])

  // Native `scroll` events don't bubble, so the listener must attach
  // directly to the real scrollable node (the ScrollArea Viewport) rather
  // than an ancestor's onScroll prop.
  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    viewport.addEventListener("scroll", handleScroll, { passive: true })
    return () => viewport.removeEventListener("scroll", handleScroll)
  }, [handleScroll])

  // Follow new content (streaming tokens, new messages) while pinned.
  useEffect(() => {
    const content = contentRef.current
    if (!content || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(() => {
      if (isPinnedRef.current) scrollToBottom("instant")
    })
    observer.observe(content)
    return () => observer.disconnect()
  }, [scrollToBottom])

  useEffect(() => {
    scrollToBottom("instant")
  }, [scrollToBottom])

  return (
    <div className={cx("hds-message-list", className)} {...rest}>
      <ScrollArea className="hds-message-list-scroll-area" viewportRef={viewportRef}>
        <div ref={contentRef} className="hds-message-list-content">
          {children}
        </div>
      </ScrollArea>
      {!isPinned && (
        <button
          type="button"
          className="hds-message-list-jump-button"
          onClick={() => {
            scrollToBottom("smooth")
            setIsPinned(true)
          }}
        >
          {jumpToLatestLabel}
        </button>
      )}
    </div>
  )
}
