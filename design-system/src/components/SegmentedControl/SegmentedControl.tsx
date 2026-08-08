import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react"
import { cx } from "../../utils/cx"
import "./SegmentedControl.css"

/** Tone of an option's trailing count badge. Omit for the neutral treatment. */
export type SegmentedTone = "neutral" | "accent" | "success" | "warning" | "danger"

export interface SegmentedOption {
  /** Stable identity, compared against `value` and passed back to `onChange`. */
  id: string
  /** Visible label. */
  label: string
  /** Optional trailing count. `0` renders — pass `undefined` to omit the badge entirely. */
  count?: number
  /** Semantic tone for the count badge (e.g. `"danger"` for an error tally). */
  tone?: SegmentedTone
  /** Renders the segment unselectable and dimmed. */
  disabled?: boolean
}

export interface SegmentedControlProps {
  options: SegmentedOption[]
  /** The selected option's `id`. */
  value: string
  onChange: (id: string) => void
  /** Accessible name for the group — required, since the control has no visible label. */
  ariaLabel: string
  /** `"sm"` for dense toolbars (default), `"md"` for standalone use. */
  size?: "sm" | "md"
  className?: string
}

/**
 * A single-select filter/view switch: one track, one segment per option, and a
 * sliding indicator that follows the selection.
 *
 * Exposed as a `radiogroup` rather than a tablist — the segments filter a view
 * that is already on screen, they don't swap panels — which also brings the
 * keyboard contract users expect: one tab stop for the whole group, arrow keys
 * to move the selection, Home/End for the ends.
 *
 * The indicator is positioned from measured segment geometry (options size
 * themselves to their labels, so a pure-CSS thumb would need equal widths and
 * would pad short labels out of proportion). It stays hidden until a
 * measurement produces a non-zero width, so environments that don't lay out —
 * jsdom, a hidden parent — render the control without a stray bar at the
 * origin.
 */
export function SegmentedControl({
  options,
  value,
  onChange,
  ariaLabel,
  size = "sm",
  className,
}: SegmentedControlProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [thumb, setThumb] = useState<{ x: number; width: number } | null>(null)

  const measure = useCallback(() => {
    const track = trackRef.current
    if (!track) return
    const active = track.querySelector<HTMLElement>('[data-active="true"]')
    if (!active) {
      setThumb(null)
      return
    }
    const width = active.offsetWidth
    setThumb(width > 0 ? { x: active.offsetLeft, width } : null)
  }, [])

  useLayoutEffect(measure, [measure, value, options])

  useEffect(() => {
    const track = trackRef.current
    if (!track || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(measure)
    observer.observe(track)
    return () => observer.disconnect()
  }, [measure])

  /** Arrow/Home/End move the selection, skipping disabled segments. */
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const selectable = options.filter((option) => !option.disabled)
    if (selectable.length === 0) return
    const current = selectable.findIndex((option) => option.id === value)
    let next = -1
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      next = (current + 1 + selectable.length) % selectable.length
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      next = (current - 1 + selectable.length) % selectable.length
    } else if (event.key === "Home") {
      next = 0
    } else if (event.key === "End") {
      next = selectable.length - 1
    }
    const target = next === -1 ? undefined : selectable[next]
    if (!target) return
    event.preventDefault()
    onChange(target.id)
  }

  return (
    <div
      ref={trackRef}
      role="radiogroup"
      aria-label={ariaLabel}
      className={cx("hds-seg", `hds-seg-${size}`, className)}
      onKeyDown={handleKeyDown}
    >
      {thumb && (
        <span
          className="hds-seg-thumb"
          aria-hidden="true"
          style={{ transform: `translateX(${thumb.x}px)`, width: `${thumb.width}px` }}
        />
      )}
      {options.map((option) => {
        const active = option.id === value
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            data-active={active}
            disabled={option.disabled}
            // One tab stop for the group: only the selected segment is reachable
            // by Tab, and arrows move from there.
            tabIndex={active ? 0 : -1}
            className="hds-seg-item"
            onClick={() => onChange(option.id)}
          >
            <span className="hds-seg-label">{option.label}</span>
            {option.count !== undefined && (
              <span className="hds-seg-count" data-tone={option.tone ?? "neutral"}>
                {option.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
