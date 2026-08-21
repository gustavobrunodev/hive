/**
 * The emblem the preparation screens are built around: the Hive mark — the
 * brain drawn in circuit traces — with signal rings leaving it, ring after
 * ring, for as long as the work is running.
 *
 * **Why rings and not the honeycomb this used to be.** The lattice was nineteen
 * hexagons around a 40px mark inside a 184px frame, and at that ratio the
 * identity on the app's most-seen first-run screen was a grid, not the logo:
 * the brain rendered as a small dark ring in the middle of somebody else's
 * pattern. The mark is the identity; everything else on this screen is staging
 * for it. So the mark is now the size of the emblem, and the motion happens
 * *around* it instead of instead of it.
 *
 * **Why motion at all.** The wait here is a real one — an npm install over the
 * network, tens of seconds to minutes — and a spinner says only "blocked".
 * Rings leaving a brain say "thinking", which is both truer and the one thing
 * this product is about. It stays cheap: three stroked circles and one
 * keyframe, transform and opacity only, no library and no canvas.
 *
 * It is ambient, not a progress indicator: nothing here claims to know how far
 * along the run is. The step rail and the caption below carry the truth; this
 * carries liveness.
 */

/**
 * How many signal rings are in flight at once, and the radius each starts at.
 *
 * Three is the count where the sequence reads as a repeating pulse rather than
 * as one lonely circle (two) or as interference (four and up, where the outer
 * ring is still fading while the next one is already born on top of it).
 */
const RINGS = 3

/**
 * The mark's radius in viewBox units — where a ring is born. Starting the ring
 * *at the edge of the mark* rather than at the centre is what makes it read as
 * something leaving the brain instead of the brain inflating.
 */
const MARK_R = 30

/** One full pulse, matching `wb-signal-out`'s duration in `workbench.css`. */
const PERIOD_S = 2.8

/**
 * How far a ring travels before it is gone. The stylesheet scales the ring by
 * `REACH / MARK_R` (2.47) — kept there rather than passed in, because a CSS
 * keyframe cannot read a JS constant and a custom property that only ever
 * holds one value is indirection pretending to be configuration.
 */
const REACH = 74

export interface HiveSignalProps {
  /**
   * `true` while work is in flight — the rings run. When the run has errored
   * they hold still, because a screen that keeps cheerfully animating under an
   * error message is telling the user two different things.
   */
  running: boolean
  className?: string
}

export function HiveSignal({ running, className }: HiveSignalProps): React.JSX.Element {
  const span = REACH * 2 + 8

  return (
    <svg
      className={className}
      viewBox={`${-span / 2} ${-span / 2} ${span} ${span}`}
      data-state={running ? 'running' : 'idle'}
      aria-hidden="true"
      focusable="false"
    >
      {Array.from({ length: RINGS }, (_, index) => (
        <circle
          key={index}
          className="wb-signal-ring"
          cx="0"
          cy="0"
          r={MARK_R}
          // Evenly spaced through one period, so the three rings read as one
          // steady pulse rather than as three circles that happen to overlap.
          style={{ ['--wb-ring-delay' as string]: `${((index / RINGS) * PERIOD_S).toFixed(2)}s` }}
        />
      ))}
      {/* The rest state has to be a complete drawing on the first frame: a
          shape that only exists inside an animation is a shape that ships
          missing wherever animations don't run (a headless render, a paused
          tab, `prefers-reduced-motion`). This one is the still ring the
          animated ones start from. */}
      <circle className="wb-signal-ring-rest" cx="0" cy="0" r={MARK_R + 12} />
    </svg>
  )
}
