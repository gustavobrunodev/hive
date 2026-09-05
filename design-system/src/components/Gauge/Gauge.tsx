import * as React from "react"
import { cx } from "../../utils/cx"
import "./Gauge.css"

export interface GaugeProps extends Omit<React.ComponentPropsWithoutRef<"div">, "children"> {
  /** How full the arc is, 0–1. Values outside the range are clamped, not thrown. */
  value: number
  /** Accessible name. Required: a ring with no name is a decoration. */
  label: string
  /** The big glyph inside the ring — a duration, a percentage, a count. */
  children?: React.ReactNode
  /** One word under the value, inside the ring. */
  caption?: React.ReactNode
  /** Ring diameter in px. The stroke and inner type scale with it. */
  size?: number
  /**
   * Which semantic colour the arc takes. `auto` (default) is the useful one
   * for a countdown: it turns from accent to warning to danger as the value
   * falls, so the ring means something before any number is read.
   */
  tone?: "auto" | "accent" | "success" | "warning" | "danger" | "neutral"
  /** What `aria-valuetext` says — a duration reads better than "43%". */
  valueText?: string
}

/** Where `auto` switches colour. Two thirds spent is a nudge; nine tenths is a warning. */
const WARNING_AT = 1 / 3
const DANGER_AT = 0.1

function autoTone(value: number): Exclude<GaugeProps["tone"], "auto" | undefined> {
  if (value <= DANGER_AT) return "danger"
  if (value <= WARNING_AT) return "warning"
  return "accent"
}

/**
 * A radial meter: one arc, one number, one word.
 *
 * `Progress` answers "how far along is this task?" — a bar with a beginning
 * and an end, read left to right. This answers a different question: **how
 * much is left of something that is draining** — a session, a quota, a
 * battery. The ring is the right picture for that because it has no
 * beginning: a user glances at how much of the circle survives, exactly the
 * way they read a watch face, and the number in the middle is confirmation
 * rather than the primary reading.
 *
 * Drawn as a single SVG circle with `stroke-dasharray`, so it scales cleanly,
 * costs no layout, and animates on one property. Colour is semantic and, by
 * default, automatic — a ring that is still coral at four minutes left would
 * be a picture that lies.
 */
export const Gauge = React.forwardRef<HTMLDivElement, GaugeProps>(function Gauge(
  { value, label, children, caption, size = 92, tone = "auto", valueText, className, ...rest },
  ref
) {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
  const resolved = tone === "auto" ? autoTone(clamped) : tone
  // The stroke is drawn on a circle inset by half its own width, so the ring
  // never clips against the viewBox edge at any size.
  const stroke = Math.max(4, Math.round(size * 0.085))
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius

  return (
    <div
      ref={ref}
      className={cx("hds-gauge", className)}
      data-tone={resolved}
      style={{ width: size, height: size }}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      {...(valueText ? { "aria-valuetext": valueText } : {})}
      {...rest}
    >
      <svg className="hds-gauge-svg" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          className="hds-gauge-track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
        />
        <circle
          className="hds-gauge-arc"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
        />
      </svg>
      <div className="hds-gauge-face">
        {children !== undefined && children !== null && (
          <span className="hds-gauge-value">{children}</span>
        )}
        {caption !== undefined && caption !== null && (
          <span className="hds-gauge-caption">{caption}</span>
        )}
      </div>
    </div>
  )
})

Gauge.displayName = "Gauge"
