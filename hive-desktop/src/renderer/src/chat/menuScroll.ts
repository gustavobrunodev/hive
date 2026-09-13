import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

/**
 * Keeping the keyboard's highlight inside the scroll port of the composer's
 * anchored menus (`/` commands, `@` files).
 *
 * ## The defect this exists for
 *
 * Both menus scroll (`max-height` + `overflow-y: auto`) and both are driven
 * from the textarea, which keeps focus: the rows are `role="option"`, pointed
 * at by `aria-activedescendant`, and never focused themselves. That is the
 * correct ARIA pattern and it is exactly why the browser does nothing for us —
 * the scroll port only follows *focus*, and focus never moves. So arrowing
 * past the last visible row moved the highlight onto a row nobody could see,
 * and the list sat still. Wrapping from the last row to the first was worse:
 * the highlight went home and the view stayed at the bottom.
 *
 * ## Why the arithmetic is a pure function
 *
 * "Is the row visible, and where must the port go if not" is a four-number
 * decision that a test can state exactly (`scrollTopFor`), while everything
 * *around* it is layout the test environment does not have. Splitting them
 * means the rule is covered by assertions rather than by mocked geometry.
 *
 * ## The lead-in
 *
 * A row that opens a section (`DO HIVE`, `SKILLS DO WORKSPACE`) is scrolled to
 * *with* its heading. Landing on the first `/bmad-*` row with the word telling
 * you what it is cropped one pixel above the fold is a worse arrival than
 * simply being two rows further down.
 */

/** The scroll port, as the two numbers this decision needs. */
export interface ScrollPort {
  /** Where the port is scrolled to right now. */
  scrollTop: number
  /** The visible height of the port. */
  height: number
}

/** The row to reveal, measured from the top of the port's content. */
export interface ItemBox {
  top: number
  height: number
}

/**
 * Where the port must scroll to so `item` is fully visible, or `null` when it
 * already is — the common case, and the one that must not touch the DOM.
 *
 * `margin` keeps a sliver of the neighbouring row in view at both edges, which
 * is what tells the eye "there is more this way" the moment the list starts
 * moving. It is clamped away at the very top so the first row still lands
 * flush against the start of the list.
 */
export function scrollTopFor(port: ScrollPort, item: ItemBox, margin = 0): number | null {
  const top = item.top - margin
  const bottom = item.top + item.height + margin
  if (top < port.scrollTop) return Math.max(0, top)
  if (bottom > port.scrollTop + port.height) return bottom - port.height
  return null
}

/** How much of the neighbouring row stays in view once the list moves. */
const REVEAL_MARGIN_PX = 8

/**
 * Measures one option row inside its list, including the section heading
 * immediately above it (see the header on why).
 *
 * `offsetTop` is read against the shared offset parent and subtracted rather
 * than assumed to be the list itself: the menus position the *card*, not the
 * `<ul>`, so a row's `offsetParent` is the card and its raw `offsetTop`
 * carries the header's height with it.
 */
function boxOf(list: HTMLElement, row: HTMLElement): ItemBox {
  const previous = row.previousElementSibling
  const heading =
    previous instanceof HTMLElement && previous.getAttribute('role') === 'presentation'
      ? previous
      : null
  const top = row.offsetTop - list.offsetTop - (heading?.offsetHeight ?? 0)
  return { top, height: row.offsetHeight + (heading?.offsetHeight ?? 0) }
}

/**
 * Scrolls the highlighted row of a listbox into view whenever the highlight
 * moves. Returns the ref to put on the scrolling `<ul>`.
 *
 * The row is found by `data-active` rather than by index so the two menus need
 * to agree on nothing but that attribute — which they already draw for the
 * highlight itself, so there is no second source of truth to keep in step.
 *
 * `revision` is the second half of the contract and not a nicety: typing
 * another character rebuilds the list under a highlight that stays at 0, and
 * an effect keyed on the index alone would not fire — leaving a port scrolled
 * halfway down a list whose new first row is the answer. Callers pass whatever
 * changes with the rows (the query, the row count).
 */
export function useActiveOptionScroll<T extends HTMLElement>(
  activeIndex: number,
  revision?: unknown
): RefObject<T> {
  const ref = useRef<T>(null)
  useEffect(() => {
    const list = ref.current
    if (!list) return
    const row = list.querySelector<HTMLElement>('[data-active]')
    if (!row) return
    const next = scrollTopFor(
      { scrollTop: list.scrollTop, height: list.clientHeight },
      boxOf(list, row),
      REVEAL_MARGIN_PX
    )
    if (next !== null) list.scrollTop = next
  }, [activeIndex, revision])
  return ref
}

/* -------------------------------------------------------------------------
 * Windowed rendering, for the `@` menu
 * ---------------------------------------------------------------------- */

/**
 * The `@` picker used to hand the menu a **page of eight** and nothing else:
 * the ninth match could not be arrowed to, scrolled to, or selected — it did
 * not exist in the DOM, and the header's "8 de 412" was the only evidence it
 * ever had. The fix is to rank every match and render only the rows near the
 * port, which is what these two pieces do: a pure function that says which
 * slice is needed, and a hook that keeps the port and the highlight agreeing
 * about it.
 *
 * Spacers are `padding-*` on the list rather than sentinel rows, so the
 * listbox's children stay exactly the options it claims to have — a spacer
 * `<li>` inside `role="listbox"` is an unnamed child that screen readers do
 * count.
 */

/** The slice to render, and the empty space standing in for the rest. */
export interface RowWindow {
  /** First row index to render. */
  start: number
  /** One past the last row index to render. */
  end: number
  /** Height of the rows above `start`, in px. */
  padTop: number
  /** Height of the rows below `end`, in px. */
  padBottom: number
}

/** Rows rendered beyond each edge, so a fast scroll doesn't show bare padding. */
const ROW_OVERSCAN = 6

/**
 * Which rows a port of `portHeight` scrolled to `scrollTop` needs, for a list
 * of `count` fixed-height rows.
 *
 * The active row is always inside the window even when the port has not moved
 * yet. That is not belt and braces: the highlight moves first and the reveal
 * scroll follows in an effect, so a window computed from `scrollTop` alone
 * would, for one commit, render a list in which the row marked `data-active`
 * does not exist — and `useActiveOptionScroll` finds the row it must reveal
 * by that very attribute.
 */
export function rowWindow(
  count: number,
  rowHeight: number,
  scrollTop: number,
  portHeight: number,
  activeIndex: number,
  overscan: number = ROW_OVERSCAN
): RowWindow {
  if (count <= 0) return { start: 0, end: 0, padTop: 0, padBottom: 0 }
  // An unmeasured port (height 0, row height 0) must render the whole list
  // rather than nothing: a menu that shows no rows because layout has not
  // happened yet is indistinguishable from a menu with no matches.
  if (rowHeight <= 0 || portHeight <= 0) {
    return { start: 0, end: count, padTop: 0, padBottom: 0 }
  }
  const first = Math.floor(Math.max(0, scrollTop) / rowHeight)
  const last = Math.ceil((Math.max(0, scrollTop) + portHeight) / rowHeight)
  let start = Math.max(0, first - overscan)
  let end = Math.min(count, last + overscan)
  if (activeIndex >= 0 && activeIndex < count) {
    start = Math.min(start, activeIndex)
    end = Math.max(end, activeIndex + 1)
  }
  return {
    start,
    end,
    padTop: start * rowHeight,
    padBottom: (count - end) * rowHeight
  }
}

export interface VirtualOptionList<T extends HTMLElement> {
  /** Goes on the scrolling `<ul>`. */
  ref: RefObject<T>
  /** The slice to render and the padding standing in for the rest. */
  window: RowWindow
  /** Wire to the `<ul>`'s `onScroll`. */
  onScroll: () => void
}

/**
 * Renders only the rows a fixed-row listbox can actually show, and keeps the
 * keyboard highlight revealed inside it.
 *
 * `rowHeight` is a contract with CSS, not a measurement: the rows are given
 * that exact height there, and the two values come from one constant so they
 * cannot drift. Measuring instead would mean reading layout during render for
 * a list that changes on every keystroke.
 *
 * `visibleRows` is only the *starting* guess for the port's height, used
 * until the element has been laid out (and in jsdom, where it never is). The
 * real height replaces it as soon as there is one.
 */
export function useVirtualOptionList<T extends HTMLElement>(
  count: number,
  rowHeight: number,
  activeIndex: number,
  visibleRows: number,
  revision?: unknown
): VirtualOptionList<T> {
  const ref = useRef<T>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [portHeight, setPortHeight] = useState(rowHeight * visibleRows)

  // The port's real height, once there is one. Re-read when the list length
  // changes because a short list makes the port shorter than its max-height.
  useEffect(() => {
    const list = ref.current
    if (!list) return
    const measured = list.clientHeight
    if (measured > 0) setPortHeight(measured)
  }, [count])

  // Reveal the highlighted row. Same contract as `useActiveOptionScroll`, but
  // the row's box is arithmetic rather than a DOM measurement — the row may
  // not be rendered yet when the highlight lands on it.
  useEffect(() => {
    const list = ref.current
    if (!list || count <= 0) return
    const next = scrollTopFor(
      { scrollTop: list.scrollTop, height: list.clientHeight || portHeight },
      { top: activeIndex * rowHeight, height: rowHeight },
      REVEAL_MARGIN_PX
    )
    if (next === null) return
    list.scrollTop = next
    setScrollTop(next)
  }, [activeIndex, revision, count, rowHeight, portHeight])

  const onScroll = useCallback(() => {
    const list = ref.current
    if (list) setScrollTop(list.scrollTop)
  }, [])

  return {
    ref,
    window: rowWindow(count, rowHeight, scrollTop, portHeight, activeIndex),
    onScroll
  }
}
