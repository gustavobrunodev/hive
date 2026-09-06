import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from "react"
import { cx } from "../../utils/cx"
import "./ActivityBorder.css"

export interface ActivityBorderProps extends ComponentPropsWithoutRef<"div"> {
  /** Whether work is in flight. `false` leaves the wrapper inert and paints nothing. */
  active?: boolean
  /**
   * Corner radius of the ring. Match the wrapped element's own radius — the
   * ring is drawn ON the child's edge, not around a new box, so a mismatch
   * shows as light running past a corner. A single length: the comet travels
   * one continuous outline, which a per-corner radius cannot describe.
   */
  radius?: string
  /** Ring thickness. Sits over the child's own border, so 1–2px is the useful range. */
  thickness?: string
  /** One full lap of the comet. Slower reads as "working", faster as "urgent". */
  duration?: string
  children?: ReactNode
}

/** The comet, back to front: each lane ends where the head ends and reaches further back. */
const LANES = ["tail", "mid", "head"] as const

/**
 * A light travelling the edge of whatever it wraps — the "something is running
 * here" signal for a surface that stays fully usable while it runs (a composer
 * you can keep typing into, a panel that keeps its content).
 *
 * ## Why an edge, and why a stroke
 *
 * A progress bar claims to know how far along the work is; a spinner takes a
 * spot in the layout and pins the eye. Neither is true of an agent turn: it has
 * no measurable end, and the surface underneath stays live. The edge is already
 * the container's own outline, so lighting it adds no box and moves nothing.
 *
 * The outline is a dashed SVG stroke rather than the usual rotating conic
 * gradient, and on the shape this is actually used on that is the whole
 * difference between a light and a smudge. A conic's angular sectors map to
 * wildly different amounts of perimeter on a wide, short box: measured on a
 * composer, the head smears across most of the top edge and then crosses each
 * short side in a couple of frames, so it reads as a gradient that flickers
 * rather than as something travelling. A dash on a `pathLength`-normalised
 * outline moves at constant speed all the way round, corners included, whatever
 * the box's proportions.
 *
 * Three lanes share one leading edge and reach progressively further back
 * (`stroke-dashoffset` shifted by exactly the extra length, so every lane still
 * advances one full lap per cycle and the loop is seamless). Stacked, they are
 * a comet with a tapering wake — not three chasing dots.
 *
 * ## Not a track
 *
 * Only the comet is drawn. The resting outline stays the host's own border, so
 * a composer that already has one does not end up with two — the host warms
 * that border while `active` if it wants a resting state.
 *
 * Purely decorative: `aria-hidden`, no role, no announcement. The state it
 * mirrors is always announced somewhere the ring is not — the stop control that
 * replaces send, the status line under the turn. Under `prefers-reduced-motion`
 * the comet stops travelling and settles into a steady accent edge, which keeps
 * the signal without the movement.
 */
export function ActivityBorder({
  active = false,
  radius,
  thickness,
  duration,
  className,
  children,
  style,
  ...rest
}: ActivityBorderProps) {
  const vars = {
    ...(radius === undefined ? null : { "--hds-activity-radius": radius }),
    ...(thickness === undefined ? null : { "--hds-activity-thickness": thickness }),
    ...(duration === undefined ? null : { "--hds-activity-duration": duration }),
    ...style,
  } as CSSProperties

  return (
    <div
      className={cx("hds-activity-border", className)}
      data-active={active || undefined}
      style={vars}
      {...rest}
    >
      {children}
      <svg className="hds-activity-border-ring" aria-hidden="true" focusable="false">
        {LANES.map((lane) => (
          // `pathLength` normalises the outline to 100 units, so one dash
          // pattern describes the comet on any size of box.
          <rect key={lane} data-lane={lane} pathLength={100} />
        ))}
      </svg>
    </div>
  )
}
