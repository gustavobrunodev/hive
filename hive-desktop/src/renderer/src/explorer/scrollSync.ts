/**
 * Keeping the reader's place across the edit ⇄ preview toggle.
 *
 * The two surfaces show the same document at wildly different heights: a
 * hundred-character source line is one row in the editor and three in the
 * rendered prose; a fenced code block is dense in one and airy in the other; a
 * table is six source lines and one grid. So the naive answer — carry the
 * scroll *ratio* across — lands somewhere else in the document every time, and
 * the further down you were, the further off it puts you.
 *
 * What survives the crossing is the **source line**. Both sides can be asked
 * where a given line is:
 *
 *  - the editor, by measuring — the wrapped height of the text above that line
 *    (`measureLineTops`), in a clone of the field itself, so wrapping, font and
 *    padding are the field's real ones and not a guess;
 *  - the preview, by asking the DOM — `Markdown` stamps every block it renders
 *    with the source line it came from (`data-line`), which is what
 *    `collectAnchors` reads back.
 *
 * The result is that leaving preview at "Critérios de aceite" and switching to
 * edit puts the caret's row on that same heading, and back again.
 */

/** Every CSS property that can move a line break or a baseline. */
const MIRRORED_PROPERTIES = [
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'font-variant',
  'letter-spacing',
  'word-spacing',
  'line-height',
  'text-transform',
  'text-indent',
  'white-space',
  'overflow-wrap',
  'word-break',
  'tab-size'
] as const

/** A rendered block and the source line it was built from. */
export interface LineAnchor {
  line: number
  top: number
  height: number
}

/**
 * Above this many lines the measurement is skipped and the caller falls back to
 * the proportional carry. One span per line is cheap for the artifacts this app
 * edits (a long PRD is ~600 lines); it is not cheap for a 50k-line log, and a
 * mode toggle that stalls for a second is worse than one that lands roughly.
 */
export const MEASURE_CEILING = 20_000

/**
 * The y offset, in the field's own scroll space, at which every source line
 * starts — index 0 is line 1.
 *
 * Measured by rebuilding the text in a hidden element that copies every metric
 * that affects layout from the field, with a zero-sized marker at the head of
 * each line. Markers are elements, not characters: the text they are threaded
 * through is byte-identical to the source, so nothing about where lines wrap
 * changes. Reading them back is one layout pass for the whole file.
 */
export function measureLineTops(field: HTMLTextAreaElement, source: string): number[] | null {
  const lines = source.split('\n')
  if (lines.length > MEASURE_CEILING) return null
  const style = window.getComputedStyle(field)
  const probe = document.createElement('div')
  const box = probe.style
  box.position = 'absolute'
  box.visibility = 'hidden'
  box.pointerEvents = 'none'
  box.top = '0'
  box.left = '-99999px'
  box.height = 'auto'
  // The width the text actually wraps in: the field's client box (which
  // already excludes whatever its scrollbar took) less its own horizontal
  // padding. Getting this wrong does not look wrong — it un-wraps a line
  // somewhere and quietly puts every offset below it in the wrong place.
  const padLeft = parseFloat(style.paddingLeft) || 0
  const padRight = parseFloat(style.paddingRight) || 0
  box.width = `${Math.max(field.clientWidth - padLeft - padRight, 1)}px`
  box.boxSizing = 'content-box'
  box.padding = '0'
  for (const property of MIRRORED_PROPERTIES) {
    box.setProperty(property, style.getPropertyValue(property))
  }

  const markers: HTMLElement[] = []
  for (const line of lines) {
    const marker = document.createElement('span')
    marker.style.display = 'inline-block'
    marker.style.width = '0'
    marker.style.height = '0'
    marker.style.overflow = 'hidden'
    probe.append(marker, document.createTextNode(`${line}\n`))
    markers.push(marker)
  }

  document.body.appendChild(probe)
  const origin = probe.getBoundingClientRect().top
  const tops = markers.map((marker) => marker.getBoundingClientRect().top - origin)
  probe.remove()
  // The field's own top padding is above all of this.
  const padding = parseFloat(style.paddingTop) || 0
  return tops.map((top) => top + padding)
}

/** The source line (1-based) whose row sits at `offset` px down the field. */
export function lineAtOffset(tops: number[], offset: number): number {
  if (tops.length === 0) return 1
  let low = 0
  let high = tops.length - 1
  while (low < high) {
    const mid = Math.ceil((low + high) / 2)
    if (tops[mid] <= offset) low = mid
    else high = mid - 1
  }
  return low + 1
}

/** Where a source line starts, in the field's scroll space. */
export function offsetOfLine(tops: number[], line: number): number {
  if (tops.length === 0) return 0
  const index = Math.min(Math.max(line - 1, 0), tops.length - 1)
  return tops[index]
}

/**
 * Every rendered block that knows which source line it came from, in document
 * order, measured against the scrolling container.
 */
export function collectAnchors(scroller: HTMLElement): LineAnchor[] {
  const origin = scroller.getBoundingClientRect().top - scroller.scrollTop
  const anchors: LineAnchor[] = []
  for (const node of scroller.querySelectorAll<HTMLElement>('[data-line]')) {
    const line = Number(node.dataset.line)
    if (!Number.isFinite(line)) continue
    const rect = node.getBoundingClientRect()
    anchors.push({ line, top: rect.top - origin, height: rect.height })
  }
  return anchors.sort((a, b) => a.line - b.line)
}

/**
 * Where to scroll the rendered document so that `line` sits at its top.
 *
 * Between two anchors the position is interpolated rather than snapped, so a
 * long paragraph — one anchor, many rows — scrolls smoothly through instead of
 * jumping from its first line to the next block's.
 */
export function topForLine(anchors: LineAnchor[], line: number): number | null {
  if (anchors.length === 0) return null
  let before: LineAnchor | null = null
  let after: LineAnchor | null = null
  for (const anchor of anchors) {
    if (anchor.line <= line) before = anchor
    else {
      after = anchor
      break
    }
  }
  if (before === null) return anchors[0].top
  if (after === null || after.line === before.line) return before.top
  const progress = (line - before.line) / (after.line - before.line)
  return before.top + (after.top - before.top) * progress
}

/** The source line showing at the top of the rendered document. */
export function lineAtTop(anchors: LineAnchor[], scrollTop: number): number | null {
  if (anchors.length === 0) return null
  let before: LineAnchor | null = null
  let after: LineAnchor | null = null
  for (const anchor of anchors) {
    if (anchor.top <= scrollTop + 1) before = anchor
    else {
      after = anchor
      break
    }
  }
  if (before === null) return anchors[0].line
  if (after === null || after.top === before.top) return before.line
  const progress = (scrollTop - before.top) / (after.top - before.top)
  return before.line + (after.line - before.line) * progress
}

/**
 * The character index at which a source line starts — what a caret has to be
 * set to in order to land on that line.
 *
 * `offsetOfLine` answers the same question in pixels, for the scroller;
 * this one answers it in characters, for the field.
 */
export function offsetOfLineStart(source: string, line: number): number {
  let at = 0
  for (let remaining = line - 1; remaining > 0; remaining--) {
    const next = source.indexOf('\n', at)
    if (next === -1) return source.length
    at = next + 1
  }
  return at
}
