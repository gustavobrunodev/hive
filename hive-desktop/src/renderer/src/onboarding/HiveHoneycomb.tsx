/**
 * The lattice the preparation screens are built around: the Hive mark at the
 * centre of a honeycomb whose cells charge outward, ring by ring, for as long
 * as the work is running.
 *
 * Why a honeycomb and not a spinner: the wait here is a real one (an npm
 * install over the network, tens of seconds to minutes), and a spinner says
 * only "blocked". This says "being assembled", it says it in the brand's own
 * geometry — the delivered `full_logo.svg` draws exactly this lattice around
 * the same mark — and it is cheap: 19 stroked paths and one keyframe, no
 * library, no canvas, transform/opacity only.
 *
 * It is ambient, not a progress indicator: nothing here claims to know how far
 * along the install is. The step rail and the caption next to it carry the
 * truth; this carries liveness.
 */

/**
 * Pointy-top hex centred on (cx, cy), at its final size.
 *
 * Deliberately not "one unit hex, placed with `scale()`": SVG scales the
 * stroke along with the geometry, so a 0.8 hairline inside a `scale(12)` came
 * out 9.6 units wide and the wireframe lattice painted as nineteen solid
 * blobs. Emitting real coordinates keeps `stroke-width` in viewBox units,
 * which is the only way a hairline stays a hairline.
 */
function hexPath(cx: number, cy: number, radius: number): string {
  const points: string[] = []
  for (let corner = 0; corner < 6; corner++) {
    const angle = ((60 * corner - 90) * Math.PI) / 180
    points.push(
      `${(cx + radius * Math.cos(angle)).toFixed(3)},${(cy + radius * Math.sin(angle)).toFixed(3)}`
    )
  }
  return `M${points.join('L')}Z`
}

/**
 * Axial hex coordinates out to `RINGS`, nearest ring first — minus the centre
 * cell, which the Hive mark occupies. Drawing that cell and then covering it
 * up is what made the mark look pasted on top of the lattice instead of
 * sitting inside it.
 */
const RINGS = 2
const CELLS = (() => {
  const cells: { q: number; r: number; ring: number }[] = []
  for (let q = -RINGS; q <= RINGS; q++) {
    for (let r = -RINGS; r <= RINGS; r++) {
      const ring = Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r))
      if (ring > 0 && ring <= RINGS) cells.push({ q, r, ring })
    }
  }
  return cells.sort((a, b) => a.ring - b.ring)
})()

/**
 * Cell circumradius and the gap between neighbours, in viewBox units. The gap
 * is a fifth of the cell: at the 10% first drawn here the lattice read as one
 * solid mass rather than as cells, which is the whole point of a honeycomb.
 */
const R = 15
const GAP = 3.1

export interface HiveHoneycombProps {
  /**
   * `true` while work is in flight — the charge wave runs. When the run has
   * errored the lattice holds still, because a screen that keeps cheerfully
   * animating under an error message is telling the user two different things.
   */
  running: boolean
  className?: string
}

export function HiveHoneycomb({ running, className }: HiveHoneycombProps): React.JSX.Element {
  const span = (RINGS + 0.5) * R * Math.sqrt(3) * 2

  return (
    <svg
      className={className}
      viewBox={`${-span / 2} ${-span / 2} ${span} ${span}`}
      data-state={running ? 'running' : 'idle'}
      aria-hidden="true"
      focusable="false"
    >
      {CELLS.map(({ q, r, ring }) => (
        <path
          key={`${q},${r}`}
          className="wb-honeycomb-cell"
          d={hexPath(R * Math.sqrt(3) * (q + r / 2), R * 1.5 * r, R - GAP)}
          // Ring distance becomes delay, so the charge reads as one wave
          // leaving the mark rather than 19 cells blinking independently.
          style={{ ['--wb-cell-delay' as string]: `${ring * 0.16}s` }}
        />
      ))}
    </svg>
  )
}
