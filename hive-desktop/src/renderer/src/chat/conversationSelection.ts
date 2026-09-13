/**
 * Which conversations are ticked, and what a click does to that.
 *
 * Pure and DOM-free, for the same reason the filters beside it are
 * (`conversationFilters.ts`): the rules that make a multi-select feel right are
 * small, they are easy to get subtly wrong, and every one of them is wrong in a
 * way a screenshot cannot show.
 *
 * ## The rules
 *
 *  - **A selection can only contain rows you can see.** The list is filtered by
 *    a window, an order and a search box, all of which move under the
 *    selection. A tick that survives its row scrolling out of existence is a
 *    conversation the next "Excluir 3" would delete without ever having shown
 *    it — so the selection is pruned against the visible rows on every read
 *    rather than trusted as stored (`visible`).
 *  - **Shift extends from the last row you touched**, through the list *as
 *    ordered on screen* — not by id, not by date. The anchor is whichever row
 *    was last toggled on its own; the range replaces nothing outside itself, so
 *    a shift-click adds to what was already ticked instead of resetting it.
 */

/** The rows a surface is showing, in the order it is showing them. */
export type VisibleIds = readonly string[]

/** The stored ticks, narrowed to rows that are actually on screen. */
export function visible(selected: ReadonlySet<string>, ids: VisibleIds): string[] {
  return ids.filter((id) => selected.has(id))
}

/** True when every visible row is ticked (and there is at least one). */
export function allSelected(selected: ReadonlySet<string>, ids: VisibleIds): boolean {
  return ids.length > 0 && ids.every((id) => selected.has(id))
}

/**
 * One row toggled, plain.
 *
 * Returns a new set — the caller stores it — because a `Set` mutated in place
 * is the one shape React will not re-render for.
 */
export function toggle(selected: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(selected)
  if (!next.delete(id)) next.add(id)
  return next
}

/**
 * Shift-click: everything between the anchor and `id`, inclusive, ticked.
 *
 * Both ends are read off the **visible order**, so the range is what the eye
 * drew. With no anchor, or with either end no longer on screen, this degrades
 * to a plain toggle rather than guessing at a range the user cannot see.
 *
 * The range always *adds*. A shift-click that also cleared the rows outside it
 * would make "tick three here, shift-click three more there" impossible, and
 * that is the gesture the whole feature exists for.
 */
export function extend(
  selected: ReadonlySet<string>,
  ids: VisibleIds,
  anchor: string | null,
  id: string
): Set<string> {
  const to = ids.indexOf(id)
  const from = anchor === null ? -1 : ids.indexOf(anchor)
  if (to === -1 || from === -1) return toggle(selected, id)
  const next = new Set(selected)
  const [start, end] = from <= to ? [from, to] : [to, from]
  for (let index = start; index <= end; index += 1) next.add(ids[index])
  return next
}

/** Every visible row ticked, or every visible row cleared — the bar's tri-state control. */
export function setAll(
  selected: ReadonlySet<string>,
  ids: VisibleIds,
  checked: boolean
): Set<string> {
  const next = new Set(selected)
  for (const id of ids) {
    if (checked) next.add(id)
    else next.delete(id)
  }
  return next
}
