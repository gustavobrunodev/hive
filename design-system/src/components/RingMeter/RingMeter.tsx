import * as React from "react"
import { cx } from "../../utils/cx"
import "./RingMeter.css"

export interface RingMeterSegment {
  /** Stable key, and the value of `data-seg` on the arc — how a host themes one run. */
  id: string
  /** This run's share of the whole ring, 0–1. Shares are drawn in order from twelve o'clock. */
  value: number
  /** Paint for this run. Omitted, it takes the built-in ramp position for its index. */
  color?: string
}

export interface RingMeterProps extends Omit<React.ComponentPropsWithoutRef<"div">, "children"> {
  /** How full the ring is, 0–1. Ignored when `segments` is given (their sum is the reading). */
  value?: number
  /**
   * The filled part, broken into runs drawn end to end. Use it when the
   * occupancy has provenance — three sources of one quantity, not three
   * statuses. Anything left over stays track.
   */
  segments?: readonly RingMeterSegment[]
  /** Accessible name. Required: a ring with no name is a decoration. */
  label: string
  /** Ring diameter in px. Everything else scales from it. */
  size?: number
  /** Stroke width in px. Defaults to a size-proportional weight that stays legible at 14px. */
  thickness?: number
  /**
   * Which semantic colour the fill takes. `auto` (default) is the useful one
   * here: it stays accent while there is room and turns as the ring fills, so
   * a glance answers "am I near the ceiling?" before any number is read.
   * Ignored for a segment that carries its own `color`.
   */
  tone?: "auto" | "accent" | "success" | "warning" | "danger" | "neutral"
  /** Where `auto` flips, as fractions filled: `[warning, danger]`. */
  thresholds?: readonly [number, number]
  /** The big glyph inside the ring — a percentage, a count, a duration. */
  children?: React.ReactNode
  /** One short line under the value, inside the ring. */
  caption?: React.ReactNode
  /** What `aria-valuetext` says, when a percentage is not the honest reading. */
  valueText?: string
  /** Renders the track only, with no reading — the "nothing measured yet" state. */
  indeterminate?: boolean
}

/** Emphasis ramp for segments that bring no colour of their own, strongest first. */
const RAMP = [100, 66, 42, 26]

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
}

function autoTone(
  filled: number,
  [warning, danger]: readonly [number, number]
): Exclude<RingMeterProps["tone"], "auto" | undefined> {
  if (filled >= danger) return "danger"
  if (filled >= warning) return "warning"
  return "accent"
}

/** One drawn run: where it starts along the circumference and how long it is. */
interface Arc {
  id: string
  offset: number
  length: number
  color?: string
}

/**
 * Lays the runs out along the circumference, in order, clamped to one lap.
 *
 * The gap is subtracted from a run's own length rather than added between
 * runs, so N segments always add up to exactly the fraction they represent —
 * a ring at 100% closes, whatever it is divided into. A run too short to give
 * the gap away keeps its full length instead of vanishing: a sliver that is
 * *there* is the whole point of drawing it.
 */
export function ringArcs(
  segments: readonly RingMeterSegment[],
  circumference: number,
  gap: number
): Arc[] {
  const arcs: Arc[] = []
  let cursor = 0
  let remaining = 1
  for (const segment of segments) {
    const share = Math.min(clamp01(segment.value), remaining)
    if (share <= 0) continue
    remaining -= share
    const full = share * circumference
    arcs.push({
      id: segment.id,
      offset: cursor,
      length: full > gap * 2 ? full - gap : full,
      ...(segment.color === undefined ? {} : { color: segment.color })
    })
    cursor += full
  }
  return arcs
}

/**
 * How one run is painted. A lone arc takes the tone straight from CSS (no
 * inline style at all, so a host can restyle it by class); runs in a set take
 * their ramp position, mixed toward the track so the steps stay separated on
 * every theme instead of collapsing on the darkest one. An explicit `color`
 * always wins — provenance is the host's vocabulary, not the ring's.
 */
function arcPaint(
  arc: Arc,
  index: number,
  single: boolean
): { style?: React.CSSProperties } {
  if (arc.color !== undefined) return { style: { stroke: arc.color } }
  if (single) return {}
  const weight = RAMP[Math.min(index, RAMP.length - 1)]
  return { style: { stroke: `color-mix(in oklab, var(--hds-ring-fill) ${weight}%, var(--surface-3))` } }
}

/**
 * A radial meter for something **filling up**: a context window, a disk, a
 * budget.
 *
 * `Progress` answers "how far along is this task?" and `Gauge` answers "how
 * much is left of something draining". This answers the third question —
 * *how full is the container* — and it exists because the two are not the
 * same picture: a countdown that turns red near zero and an occupancy that
 * turns red near the top read in opposite directions, and one component
 * doing both would need the caller to invert every threshold.
 *
 * Why a ring rather than a bar:
 *
 * - **It survives being small.** A 4px-tall bar 34px wide is a hairline that
 *   the eye files as a divider. A 16px ring with a 2.5px stroke, at the same
 *   footprint, still reads as *a dial with an amount in it* — which is what a
 *   number beside it needs to be believed.
 * - **It has no beginning.** Occupancy is a state, not a journey, and a shape
 *   read all at once says so; left-to-right implies progress towards
 *   something.
 * - **Segments stay one quantity.** Runs of one hue at descending emphasis
 *   read as provenance of a single fill, where a bar cut into blocks starts
 *   to read as separate statuses.
 *
 * Drawn as SVG circles with `stroke-dasharray`, so it costs no layout, scales
 * to any size and animates on one property.
 */
export const RingMeter = React.forwardRef<HTMLDivElement, RingMeterProps>(function RingMeter(
  {
    value = 0,
    segments,
    label,
    size = 44,
    thickness,
    tone = "auto",
    thresholds = [0.75, 0.9],
    children,
    caption,
    valueText,
    indeterminate = false,
    className,
    ...rest
  },
  ref
) {
  const runs = segments ?? [{ id: "value", value }]
  const filled = indeterminate ? 0 : clamp01(runs.reduce((sum, run) => sum + clamp01(run.value), 0))
  const resolved = tone === "auto" ? autoTone(filled, thresholds) : tone

  // The stroke sits on a circle inset by half its own width, so the ring never
  // clips against the viewBox at any size. The 0.16 factor is what keeps a
  // 16px ring reading as a ring instead of as a dot with a halo.
  const stroke = thickness ?? Math.max(2, Math.round(size * 0.16 * 10) / 10)
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  // One stroke-width of clear air between runs, but never more than a tenth of
  // the lap — at three runs on a 16px ring a full-stroke gap would eat the fill.
  const gap = Math.min(stroke, circumference / 10)
  const arcs = indeterminate ? [] : ringArcs(runs, circumference, runs.length > 1 ? gap : 0)
  const single = arcs.length === 1

  return (
    <div
      ref={ref}
      className={cx("hds-ring-meter", className)}
      data-tone={resolved}
      data-indeterminate={indeterminate || undefined}
      style={{ width: size, height: size }}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(filled * 100)}
      {...(valueText ? { "aria-valuetext": valueText } : {})}
      {...rest}
    >
      <svg className="hds-ring-meter-svg" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          className="hds-ring-meter-track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
        />
        {arcs.map((arc, index) => (
          <circle
            key={arc.id}
            className="hds-ring-meter-arc"
            data-seg={arc.id}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            // Round caps on a lone arc; butt caps once there are neighbours,
            // where a rounded end would overhang the gap it was given.
            strokeLinecap={single ? "round" : "butt"}
            strokeDasharray={`${arc.length} ${circumference - arc.length}`}
            strokeDashoffset={-arc.offset}
            {...arcPaint(arc, index, single)}
          />
        ))}
      </svg>
      {(children !== undefined && children !== null) ||
      (caption !== undefined && caption !== null) ? (
        // The face scales with the ring instead of taking a fixed step: the
        // same component draws a 92px dial in a panel and a 132px one in a
        // sheet, and type that doesn't follow makes the larger one look empty.
        <div
          className="hds-ring-meter-face"
          style={
            {
              "--hds-ring-value-size": `${Math.max(12, Math.round(size * 0.21))}px`,
              "--hds-ring-caption-size": `${Math.max(9, Math.round(size * 0.105))}px`
            } as React.CSSProperties
          }
        >
          {children !== undefined && children !== null && (
            <span className="hds-ring-meter-value">{children}</span>
          )}
          {caption !== undefined && caption !== null && (
            <span className="hds-ring-meter-caption">{caption}</span>
          )}
        </div>
      ) : null}
    </div>
  )
})

RingMeter.displayName = "RingMeter"
