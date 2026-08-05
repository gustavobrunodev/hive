// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { act, cleanup, render } from '@testing-library/react'
import { graphemesOf, useSmoothStream } from './useSmoothStream'

/**
 * The reveal's contract is behavioral: never show a partial grapheme, always
 * converge on the full text, and never animate backwards across turns. The
 * rAF loop is driven manually so the assertions are about frames, not wall
 * clock.
 */

/**
 * A `MediaQueryList` stand-in. The hook only ever reads `matches`; the
 * listener pair is present so the stub stays structurally honest about what a
 * real `matchMedia` returns.
 */
function stubMediaQuery(
  matches: boolean
): Pick<MediaQueryList, 'matches' | 'addEventListener' | 'removeEventListener'> {
  return {
    matches,
    addEventListener: noop,
    removeEventListener: noop
  } as Pick<MediaQueryList, 'matches' | 'addEventListener' | 'removeEventListener'>
}

function noop(): void {
  // Listener registration the hook never uses.
}

let frames: FrameRequestCallback[] = []
let now = 0

function flushFrame(delta = 16): void {
  now += delta
  const due = frames
  frames = []
  act(() => {
    for (const frame of due) frame(now)
  })
}

/** Runs frames until the reveal stops asking for more (or the budget runs out). */
function flushAll(budget = 400): void {
  let guard = 0
  while (frames.length > 0 && guard < budget) {
    flushFrame()
    guard += 1
  }
}

function renderStream(initial: string | null): {
  value: () => string | null
  update: (next: string | null) => void
} {
  let latest: string | null = null
  function Probe({ target }: { target: string | null }): null {
    latest = useSmoothStream(target)
    return null
  }
  const view = render(createElement(Probe, { target: initial }))
  return {
    value: () => latest,
    update: (next) => {
      act(() => {
        view.rerender(createElement(Probe, { target: next }))
      })
    }
  }
}

describe('graphemesOf', () => {
  it('keeps an emoji whole — the split that made a streamed emoji paint as a broken box', () => {
    // A ZWJ family + a skin-tone modifier: five code points, one glyph each.
    expect(graphemesOf('👩‍💻')).toEqual(['👩‍💻'])
    expect(graphemesOf('👍🏽')).toEqual(['👍🏽'])
    expect(graphemesOf('a👍🏽b')).toEqual(['a', '👍🏽', 'b'])
  })

  it('handles plain text and combining marks', () => {
    expect(graphemesOf('épico')).toEqual(['é', 'p', 'i', 'c', 'o'])
    expect(graphemesOf('')).toEqual([])
  })
})

describe('useSmoothStream', () => {
  beforeEach(() => {
    frames = []
    now = 0
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback)
      return frames.length
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})
    vi.stubGlobal('matchMedia', () => stubMediaQuery(false))
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('passes null straight through — nothing streaming, nothing to pace', () => {
    const stream = renderStream(null)
    expect(stream.value()).toBeNull()
  })

  it('reveals a chunk progressively instead of dumping it, and converges on the whole text', () => {
    const chunk = 'A'.repeat(200)
    const stream = renderStream('')
    stream.update(chunk)

    flushFrame()
    const afterOne = stream.value() as string
    // Something showed, but nowhere near all of it — that gap IS the fix.
    expect(afterOne.length).toBeGreaterThan(0)
    expect(afterOne.length).toBeLessThan(chunk.length)

    flushAll()
    expect(stream.value()).toBe(chunk)
  })

  it('never emits a partial emoji, even mid-reveal', () => {
    const text = '🎉🚀👩‍💻✅ pronto'
    const stream = renderStream('')
    stream.update(text)

    for (let i = 0; i < 8 && frames.length > 0; i += 1) {
      flushFrame(4)
      const shown = stream.value() as string
      // A lone surrogate half would fail this: it renders as U+FFFD.
      expect(shown.includes('�')).toBe(false)
      expect(text.startsWith(shown)).toBe(true)
    }
    flushAll()
    expect(stream.value()).toBe(text)
  })

  it('keeps up with successive chunks rather than falling further behind', () => {
    const stream = renderStream('')
    stream.update('primeiro pedaço. ')
    flushAll()
    stream.update('primeiro pedaço. segundo pedaço.')
    flushAll()
    expect(stream.value()).toBe('primeiro pedaço. segundo pedaço.')
  })

  it('restarts on a new turn instead of flashing the previous turn’s tail', () => {
    const stream = renderStream('')
    stream.update('resposta antiga completa')
    flushAll()
    expect(stream.value()).toBe('resposta antiga completa')

    // A new turn resets the buffer to '' before its first token arrives.
    stream.update('')
    expect(stream.value()).toBe('')
    stream.update('nova')
    // Before any frame runs, nothing of the old reply may still be showing.
    expect(stream.value()).toBe('')
    flushAll()
    expect(stream.value()).toBe('nova')
  })

  it('reveals instantly under prefers-reduced-motion, with no animation at all', () => {
    vi.stubGlobal('matchMedia', () => stubMediaQuery(true))
    const stream = renderStream('')
    stream.update('tudo de uma vez')
    expect(stream.value()).toBe('tudo de uma vez')
    expect(frames).toHaveLength(0)
  })
})
