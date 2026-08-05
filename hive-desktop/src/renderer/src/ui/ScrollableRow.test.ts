// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ScrollableRow } from './ScrollableRow'

/**
 * The shortcut strip hid 966px of its 1641px behind a suppressed scrollbar —
 * six of ten chips, with nothing on screen admitting they existed. What matters
 * here is therefore not that the row renders, but that its *overflow state
 * machine* is driven by real measurements: a paddle exists exactly when that
 * edge has something past it, and pressing one moves the track.
 *
 * jsdom has no layout, so `scrollWidth`/`clientWidth` are 0 and `scrollBy` is
 * missing — both are supplied per test, which is also what makes the
 * "no overflow → no paddles" case expressible at all.
 */
/** Captures the callback so a test can fire a resize the way the pane splitter would. */
let fireResize: (() => void) | null = null
class ObserverStub {
  constructor(callback: () => void) {
    fireResize = callback
  }
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
  takeRecords = vi.fn(() => [])
}
vi.stubGlobal('ResizeObserver', ObserverStub)

/** Fakes layout on the track: a viewport of `client` px over `scroll` px of content. */
function measureTrack(scroll: number, client: number): HTMLElement {
  const track = document.querySelector('.wb-scroll-row-track') as HTMLElement
  Object.defineProperty(track, 'scrollWidth', { value: scroll, configurable: true })
  Object.defineProperty(track, 'clientWidth', { value: client, configurable: true })
  track.scrollBy = vi.fn(({ left }: ScrollToOptions = {}) => {
    // jsdom won't move it for us; mimic a clamped scroll so the next
    // `scroll` event reports a real position.
    track.scrollLeft = Math.max(0, Math.min(scroll - client, track.scrollLeft + (left ?? 0)))
    fireEvent.scroll(track)
  }) as HTMLElement['scrollBy']
  fireEvent.scroll(track)
  return track
}

function renderRow(extra: { className?: string; trackClassName?: string } = {}): void {
  render(
    createElement(
      ScrollableRow,
      {
        ariaLabel: 'atalhos',
        role: 'toolbar',
        scrollBackLabel: 'anteriores',
        scrollForwardLabel: 'mais',
        ...extra
      },
      createElement('button', { key: 'a', type: 'button' }, 'um'),
      createElement('button', { key: 'b', type: 'button' }, 'dois')
    )
  )
}

// Queried by selector, not by role: a retired paddle is `aria-hidden` (it's
// invisible and unclickable, so exposing it to a screen reader would be a lie)
// and role queries deliberately can't see it.
const paddle = (edge: 'start' | 'end'): HTMLElement =>
  document.querySelector(`.wb-scroll-row-paddle[data-edge="${edge}"]`) as HTMLElement
const back = (): HTMLElement => paddle('start')
const forward = (): HTMLElement => paddle('end')

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof matchMedia
})
afterEach(() => cleanup())

describe('ScrollableRow', () => {
  it('shows no paddle while everything fits', () => {
    renderRow()
    measureTrack(300, 300)

    expect(back().hasAttribute('data-visible')).toBe(false)
    expect(forward().hasAttribute('data-visible')).toBe(false)
  })

  it('offers only the forward paddle at the start of an overflowing track', () => {
    renderRow()
    measureTrack(1000, 400)

    expect(back().hasAttribute('data-visible')).toBe(false)
    expect(forward().hasAttribute('data-visible')).toBe(true)
  })

  it('offers both paddles mid-track and only the back one at the end', () => {
    renderRow()
    const track = measureTrack(1000, 400)

    track.scrollLeft = 300
    fireEvent.scroll(track)
    expect(back().hasAttribute('data-visible')).toBe(true)
    expect(forward().hasAttribute('data-visible')).toBe(true)

    track.scrollLeft = 600
    fireEvent.scroll(track)
    expect(back().hasAttribute('data-visible')).toBe(true)
    expect(forward().hasAttribute('data-visible')).toBe(false)
  })

  it('pages by 80% of the visible width, in each direction', () => {
    renderRow()
    const track = measureTrack(1000, 400)

    fireEvent.click(forward())
    expect(track.scrollBy).toHaveBeenCalledWith({ left: 320, behavior: 'smooth' })
    expect(track.scrollLeft).toBe(320)

    fireEvent.click(back())
    expect(track.scrollBy).toHaveBeenLastCalledWith({ left: -320, behavior: 'smooth' })
    expect(track.scrollLeft).toBe(0)
  })

  it('keeps a minimum page so a very narrow track still moves', () => {
    renderRow()
    const track = measureTrack(1000, 100)

    fireEvent.click(forward())
    expect(track.scrollBy).toHaveBeenCalledWith({ left: 120, behavior: 'smooth' })
  })

  it('jumps instead of gliding under prefers-reduced-motion', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof matchMedia
    renderRow()
    const track = measureTrack(1000, 400)

    fireEvent.click(forward())
    expect(track.scrollBy).toHaveBeenCalledWith({ left: 320, behavior: 'auto' })
  })

  it('turns a vertical wheel over the track into horizontal scrolling', () => {
    renderRow()
    const track = measureTrack(1000, 400)

    fireEvent.wheel(track, { deltaY: 90, deltaX: 0 })
    expect(track.scrollLeft).toBe(90)
  })

  it("leaves a trackpad's own horizontal gesture alone", () => {
    renderRow()
    const track = measureTrack(1000, 400)

    fireEvent.wheel(track, { deltaY: 10, deltaX: 40 })
    expect(track.scrollLeft).toBe(0)
  })

  it('ignores the wheel when there is nothing to scroll', () => {
    renderRow()
    const track = measureTrack(300, 300)

    fireEvent.wheel(track, { deltaY: 90, deltaX: 0 })
    expect(track.scrollLeft).toBe(0)
  })

  it('names the track for assistive tech and keeps the paddles out of the tab order', () => {
    renderRow()
    const track = measureTrack(1000, 400)
    track.scrollLeft = 300
    fireEvent.scroll(track)

    expect(screen.getByRole('toolbar', { name: 'atalhos' })).toBeTruthy()
    // Both reachable by their accessible name while they can actually be used.
    expect(screen.getByRole('button', { name: 'anteriores' })).toBe(back())
    expect(screen.getByRole('button', { name: 'mais' })).toBe(forward())
    // The chips themselves are the tab stops; Tab already scrolls them into view.
    expect(back().tabIndex).toBe(-1)
    expect(forward().tabIndex).toBe(-1)
  })

  it('hides a retired paddle from assistive tech rather than leaving a dead control', () => {
    renderRow()
    measureTrack(1000, 400)

    expect(back().getAttribute('aria-hidden')).toBe('true')
    expect(forward().getAttribute('aria-hidden')).toBe('false')
    expect(screen.queryByRole('button', { name: 'anteriores' })).toBeNull()
  })

  // The chat pane is resizable: the same chips can go from fitting to
  // overflowing without a scroll or a re-render, so width is observed.
  it('re-measures when the track is resized', () => {
    renderRow()
    const track = measureTrack(300, 300)
    expect(forward().hasAttribute('data-visible')).toBe(false)

    Object.defineProperty(track, 'clientWidth', { value: 150, configurable: true })
    act(() => fireResize?.())
    expect(forward().hasAttribute('data-visible')).toBe(true)
  })

  it('still renders where ResizeObserver is unavailable', () => {
    vi.stubGlobal('ResizeObserver', undefined)
    renderRow()
    measureTrack(1000, 400)

    expect(forward().hasAttribute('data-visible')).toBe(true)
    vi.stubGlobal('ResizeObserver', ObserverStub)
  })

  it('glides by default where motion preference cannot be read', () => {
    // @ts-expect-error — deliberately removing the API to take the fallback path.
    delete window.matchMedia
    renderRow()
    const track = measureTrack(1000, 400)

    fireEvent.click(forward())
    expect(track.scrollBy).toHaveBeenCalledWith({ left: 320, behavior: 'smooth' })
  })

  it('merges the caller classes onto the row and its track', () => {
    renderRow({ className: 'wb-shortcut-strip-row', trackClassName: 'wb-shortcut-strip-scroll' })

    expect(document.querySelector('.wb-scroll-row.wb-shortcut-strip-row')).toBeTruthy()
    expect(document.querySelector('.wb-scroll-row-track.wb-shortcut-strip-scroll')).toBeTruthy()
  })
})
