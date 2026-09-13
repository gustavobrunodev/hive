// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { rowWindow, scrollTopFor, useActiveOptionScroll } from './menuScroll'
import { SlashMenu } from './SlashMenu'
import type { SlashCommand } from './slashCommands'

/**
 * The arithmetic of "keep the highlighted row in view", and the wiring that
 * applies it to a real listbox.
 *
 * jsdom lays nothing out, so the three numbers the hook reads (`offsetTop`,
 * `offsetHeight`, `clientHeight`) are installed here as a fake layout: rows of
 * a fixed height stacked in document order, inside a port two rows tall. That
 * is enough for the two assertions the reported bug is about — arrowing past
 * the fold moves the port, and wrapping back to the first row brings it home.
 */

const ROW = 40
const HEADING = 20
const PORT = 100

/** Heights by element kind; everything else measures zero, as in the real menu. */
function heightOf(element: Element): number {
  if (element.tagName !== 'LI') return 0
  return element.getAttribute('role') === 'presentation' ? HEADING : ROW
}

/**
 * Installs the fake layout on `HTMLElement.prototype` — the only seam jsdom
 * leaves, since these are getters on every element. Restored by
 * `vi.restoreAllMocks` in `afterEach`.
 */
function installLayout(): void {
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (
    this: HTMLElement
  ) {
    return heightOf(this)
  })
  vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (
    this: HTMLElement
  ) {
    let top = 0
    for (
      let sibling = this.previousElementSibling;
      sibling !== null;
      sibling = sibling.previousElementSibling
    ) {
      top += heightOf(sibling)
    }
    return top
  })
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (
    this: HTMLElement
  ) {
    return this.tagName === 'UL' ? PORT : heightOf(this)
  })
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('scrollTopFor', () => {
  it('leaves a fully visible row alone', () => {
    expect(scrollTopFor({ scrollTop: 0, height: 100 }, { top: 20, height: 40 })).toBeNull()
  })

  it('scrolls down just enough to reveal a row past the bottom edge', () => {
    // The row occupies 100–140 in a port showing 0–100: the port must end at 140.
    expect(scrollTopFor({ scrollTop: 0, height: 100 }, { top: 100, height: 40 })).toBe(40)
  })

  it('scrolls up to reveal a row above the top edge', () => {
    expect(scrollTopFor({ scrollTop: 120, height: 100 }, { top: 40, height: 40 })).toBe(40)
  })

  it('keeps a sliver of the neighbouring row in view when a margin is given', () => {
    expect(scrollTopFor({ scrollTop: 0, height: 100 }, { top: 100, height: 40 }, 8)).toBe(48)
    expect(scrollTopFor({ scrollTop: 120, height: 100 }, { top: 40, height: 40 }, 8)).toBe(32)
  })

  it('never scrolls past the start of the list for the margin of the first row', () => {
    expect(scrollTopFor({ scrollTop: 4, height: 100 }, { top: 0, height: 40 }, 8)).toBe(0)
  })
})

const COMMANDS: SlashCommand[] = Array.from({ length: 8 }, (_, index) => ({
  key: `bmad-cmd-${index}`,
  label: `Comando ${index}`,
  description: `Descrição ${index}`,
  kind: 'skill' as const
}))

function menu(highlightIndex: number): React.JSX.Element {
  return createElement(SlashMenu, {
    items: COMMANDS,
    query: '',
    highlightIndex,
    onHighlight: vi.fn(),
    onSelect: vi.fn(),
    emptyLabel: '',
    note: null,
    listboxId: 'slash'
  })
}

describe('useActiveOptionScroll (through SlashMenu)', () => {
  it('follows the highlight past the fold and back to the top on a wrap', () => {
    installLayout()
    const { rerender } = render(menu(0))
    const list = screen.getByRole('listbox')
    expect(list.scrollTop).toBe(0)

    // Last row: heading (20) + seven rows (280) above it, 40 tall, 8 of margin
    // under it, in a 100-tall port.
    rerender(menu(7))
    expect(list.scrollTop).toBe(HEADING + 7 * ROW + ROW + 8 - PORT)

    // ArrowDown on the last row wraps to the first — the case where the
    // highlight went home and the port used to stay at the bottom. The first
    // row is revealed together with its section heading.
    rerender(menu(0))
    expect(list.scrollTop).toBe(0)
  })

  it('re-reveals the first row when the list itself changes under a still highlight', () => {
    installLayout()
    const { rerender } = render(menu(7))
    const list = screen.getByRole('listbox')
    expect(list.scrollTop).toBeGreaterThan(0)

    // Typing another character rebuilds the rows with the highlight still at
    // its clamped index; the port must come back to the new top.
    rerender(
      createElement(SlashMenu, {
        items: COMMANDS.slice(0, 3),
        query: 'cmd',
        highlightIndex: 0,
        onHighlight: vi.fn(),
        onSelect: vi.fn(),
        emptyLabel: '',
        note: null,
        listboxId: 'slash'
      })
    )
    expect(list.scrollTop).toBe(0)
  })

  it('is a no-op when there is no highlighted row to reveal', () => {
    installLayout()
    function Harness(): React.JSX.Element {
      const ref = useActiveOptionScroll<HTMLUListElement>(0)
      return createElement('ul', { ref, role: 'listbox' })
    }
    render(createElement(Harness))
    expect(screen.getByRole('listbox').scrollTop).toBe(0)
  })
})

/**
 * The `@` picker's windowed rendering. The arithmetic is the whole rule, and
 * the defect it replaces was a list that simply did not contain its own
 * matches past the eighth.
 *
 * The spacer these numbers describe is padding, and padding must sit on the
 * listbox INSIDE the scroll port, never on the port itself: under
 * `box-sizing: border-box` a box can never be shorter than its own padding,
 * so a port carrying both ignores its `max-height` entirely. Measured in the
 * built app before the fix: 1536px of port where 256 was asked for.
 */
describe('rowWindow', () => {
  const ROW = 32
  const PORT = ROW * 8

  it('renders the visible rows plus overscan, and stands the rest up as padding', () => {
    const win = rowWindow(400, ROW, 0, PORT, 0, 6)
    expect(win.start).toBe(0)
    expect(win.end).toBe(14)
    expect(win.padTop).toBe(0)
    expect(win.padBottom).toBe((400 - 14) * ROW)
  })

  it('follows the scroll: the padding above and below always adds up to the whole list', () => {
    const win = rowWindow(400, ROW, ROW * 100, PORT, 100, 6)
    expect(win.start).toBe(94)
    expect(win.end).toBe(114)
    expect(win.padTop + (win.end - win.start) * ROW + win.padBottom).toBe(400 * ROW)
  })

  it('keeps the active row inside the window even when the port has not moved yet', () => {
    // The highlight lands first; the reveal scroll is an effect that runs
    // after. For that one commit the row marked `data-active` must still
    // exist, or the effect has nothing to find.
    const win = rowWindow(400, ROW, 0, PORT, 300, 6)
    expect(win.start).toBeLessThanOrEqual(300)
    expect(win.end).toBeGreaterThan(300)
  })

  it('never runs past either end of the list', () => {
    expect(rowWindow(5, ROW, 0, PORT, 0, 6)).toEqual({
      start: 0,
      end: 5,
      padTop: 0,
      padBottom: 0
    })
    const bottom = rowWindow(20, ROW, ROW * 12, PORT, 19, 6)
    expect(bottom.end).toBe(20)
    expect(bottom.padBottom).toBe(0)
  })

  it('renders everything rather than nothing when the port has not been measured', () => {
    // jsdom, and the first paint in a browser. A window computed from a zero
    // height would render no rows at all, which reads exactly like "no match".
    expect(rowWindow(30, ROW, 0, 0, 0)).toEqual({ start: 0, end: 30, padTop: 0, padBottom: 0 })
    expect(rowWindow(30, 0, 0, PORT, 0)).toEqual({ start: 0, end: 30, padTop: 0, padBottom: 0 })
  })

  it('is empty for an empty list', () => {
    expect(rowWindow(0, ROW, 0, PORT, 0)).toEqual({ start: 0, end: 0, padTop: 0, padBottom: 0 })
  })

  it('treats a negative scroll position (rubber-banding) as the top', () => {
    expect(rowWindow(400, ROW, -80, PORT, 0, 6).start).toBe(0)
  })
})
