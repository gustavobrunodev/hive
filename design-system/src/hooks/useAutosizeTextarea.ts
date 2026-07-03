import { useEffect, useRef, type RefObject } from "react"

export type UseAutosizeTextareaOptions = {
  minRows?: number
  maxRows?: number
}

/**
 * Resizes a `<textarea>` to fit its content between `minRows` and
 * `maxRows`, re-measuring on every `value` change (and on mount / element
 * resize, e.g. the textarea's width changing rewraps its lines).
 *
 * Follows `useReveal`'s ref-returning ergonomics: attach the returned ref
 * to the textarea, and pass the controlled `value` in so the effect knows
 * when content changed.
 *
 * jsdom doesn't perform real layout, so `getComputedStyle`/`scrollHeight`
 * report placeholder values there (and older environments may lack
 * `ResizeObserver` entirely) — every measurement is wrapped so a missing
 * or unusual environment degrades to a no-op instead of throwing.
 */
export function useAutosizeTextarea(
  value: string,
  { minRows = 1, maxRows }: UseAutosizeTextareaOptions = {}
): RefObject<HTMLTextAreaElement | null> {
  const ref = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    const resize = () => {
      try {
        if (typeof window === "undefined" || typeof window.getComputedStyle !== "function") {
          return
        }

        const computed = window.getComputedStyle(node)

        let lineHeight = parseFloat(computed.lineHeight)
        if (!Number.isFinite(lineHeight) || lineHeight <= 0) {
          const fontSize = parseFloat(computed.fontSize)
          lineHeight = Number.isFinite(fontSize) && fontSize > 0 ? fontSize * 1.2 : 20
        }

        const paddingTop = parseFloat(computed.paddingTop) || 0
        const paddingBottom = parseFloat(computed.paddingBottom) || 0
        const borderTop = parseFloat(computed.borderTopWidth) || 0
        const borderBottom = parseFloat(computed.borderBottomWidth) || 0
        const extra = paddingTop + paddingBottom + borderTop + borderBottom

        // Reset first so `scrollHeight` reflects the natural content
        // height rather than whatever height we previously set.
        node.style.height = "auto"
        const scrollHeight = node.scrollHeight

        const minHeight = lineHeight * minRows + extra
        const maxHeight = maxRows ? lineHeight * maxRows + extra : Infinity

        const nextHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight)
        node.style.height = `${nextHeight}px`
        node.style.overflowY = maxRows !== undefined && scrollHeight > maxHeight ? "auto" : "hidden"
      } catch {
        // Measurement isn't available/reliable in this environment
        // (e.g. jsdom); leave the textarea's height untouched.
      }
    }

    resize()

    let observer: ResizeObserver | undefined
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => resize())
      observer.observe(node)
    }

    return () => observer?.disconnect()
  }, [value, minRows, maxRows])

  return ref
}
