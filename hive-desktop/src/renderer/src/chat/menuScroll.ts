import { useEffect, useRef, type RefObject } from 'react'

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
