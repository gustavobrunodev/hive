/**
 * Derives the horizontal lockups (and the `currentColor` variants) from the
 * shipped vertical artwork, so the whole family stays one drawing.
 *
 * The delivered lockups are all *vertical* stacks (mark over wordmark) on a
 * fixed 1408×768 canvas with the artwork occupying ~20% of it. App chrome —
 * a 46px title bar — needs the opposite: a wide, short lockup whose CSS height
 * means what it says. Rather than redraw the wordmark (it is a specific
 * typeface, already outlined), this splits `*_logo_simple.svg` into its two
 * groups and re-lays them out side by side.
 *
 * Path order in the source is stable and semantic: the first five paths are
 * the brain mark, the last four are H / I / V / E. The bounding boxes below
 * were measured with `getBBox()` in a real browser (a path parser guesses at
 * cubic extrema; the browser does not).
 *
 * Run: `node scripts/gen-logo-lockups.mjs` from `design-system/`.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ASSETS = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'logos')

/** Browser-measured bounding boxes inside the 1408×768 source canvas. */
const MARK_BOX = { x: 562.76, y: 159.51, w: 284.15, h: 295.18 }
const WORD_BOX = { x: 507.81, y: 491.44, w: 394.51, h: 97 }

/**
 * Lockup proportions, in units of the mark's height (which is normalised to
 * 100). The wordmark's cap height sits at 58% of the mark and is optically
 * centred against it; the gap is a little over a quarter of the mark height —
 * wide enough that the brain's outer strokes never crowd the `H`.
 */
const MARK_H = 100
const WORD_CAP = 58
const GAP = 32

const TONES = { black: '#000000', white: '#FFFFFF', current: 'currentColor' }

function round(n) {
  return Number(n.toFixed(4))
}

function paths(svg) {
  const all = [...svg.matchAll(/<path\b[^>]*\/>/g)].map((m) => m[0])
  if (all.length !== 9) {
    throw new Error(`expected 9 paths in the simple lockup, found ${all.length}`)
  }
  return { mark: all.slice(0, 5), word: all.slice(5) }
}

function recolor(path, fill) {
  return path.replace(/fill="[^"]*"/, `fill="${fill}"`)
}

/**
 * `<g>` that maps a source box onto `scale`, with its top-left at (x, y).
 * Grouped by *class*, not id: consumers inject these inline, and two lockups
 * on one page would otherwise ship duplicate ids.
 */
function placed(name, list, box, scale, x, y, fill) {
  const tx = round(x - box.x * scale)
  const ty = round(y - box.y * scale)
  const body = list.map((p) => '    ' + recolor(p, fill)).join('\n')
  return `  <g class="${name}" transform="translate(${tx} ${ty}) scale(${round(scale)})">\n${body}\n  </g>`
}

function svgDoc(width, height, groups) {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${round(width)} ${round(height)}">`,
    groups.join('\n'),
    '</svg>',
    ''
  ].join('\n')
}

const source = readFileSync(join(ASSETS, 'white_logo_simple.svg'), 'utf8')
const { mark, word } = paths(source)

const markScale = MARK_H / MARK_BOX.h
const markW = MARK_BOX.w * markScale
const wordScale = WORD_CAP / WORD_BOX.h
const wordW = WORD_BOX.w * wordScale

for (const [tone, fill] of Object.entries(TONES)) {
  // Horizontal lockup: mark, gap, wordmark — the wordmark optically centred.
  writeFileSync(
    join(ASSETS, `${tone}_logo_lockup.svg`),
    svgDoc(markW + GAP + wordW, MARK_H, [
      placed('hds-logo-mark', mark, MARK_BOX, markScale, 0, 0, fill),
      placed(
        'hds-logo-wordmark',
        word,
        WORD_BOX,
        wordScale,
        markW + GAP,
        (MARK_H - WORD_CAP) / 2,
        fill
      )
    ])
  )

  // Mark on its own, cropped to the artwork so a CSS height means what it says.
  writeFileSync(
    join(ASSETS, `${tone}_logo_mark.svg`),
    svgDoc(markW, MARK_H, [placed('hds-logo-mark', mark, MARK_BOX, markScale, 0, 0, fill)])
  )
}

console.log(`lockup ${round(markW + GAP + wordW)}×${MARK_H}, mark ${round(markW)}×${MARK_H}`)
