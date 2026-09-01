// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { KeyboardEvent } from 'react'
import { useComposerDictation, type ComposerDictation } from './useComposerDictation'
import type { DictationEngine } from './useDictation'
import type { Capture } from './micCapture'
import type { Tick } from './segmenter'

/**
 * The textarea-specific half: caret restoration, the self-clearing landing
 * mark, and the composer-scoped keys. Driven directly rather than through Chat,
 * because the branches that matter here — a field with no element, a key event
 * a menu already claimed — are awkward to reach from the outside.
 */

const tickListeners: ((tick: Tick) => void)[] = []
let stopped = 0

vi.mock('./micCapture', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./micCapture')>()
  return {
    ...actual,
    startCapture: async (): Promise<Capture> => ({
      onTick: (listener) => tickListeners.push(listener),
      onLevels: () => undefined,
      stop: () => {
        stopped += 1
      }
    })
  }
})

function engineReturning(text: string): DictationEngine {
  return { phase: { status: 'idle' }, transcribe: async () => text, warm: async () => {} }
}

/**
 * An engine whose answer changes between calls — a live pass guessing at an
 * unfinished phrase, then the segment's own pass over the finished one.
 */
function engineSaying(...answers: string[]): DictationEngine {
  let call = 0
  return {
    phase: { status: 'idle' },
    transcribe: async () => answers[Math.min(call++, answers.length - 1)],
    warm: async () => {}
  }
}

/** Feeds `ms` of audio at one level, in 32 ms ticks. */
function emit(ms: number, rms: number): void {
  for (let i = 0; i < Math.ceil(ms / 32); i += 1) {
    for (const listener of tickListeners) {
      listener({ rms, samples: new Float32Array(512).fill(rms) })
    }
  }
}

interface Harness {
  result: { current: ComposerDictation }
  element: HTMLTextAreaElement
  value: () => string
}

function mount(initial = '', engine = engineReturning('ditado')): Harness {
  const element = document.createElement('textarea')
  document.body.append(element)
  element.value = initial

  const state = { value: initial }
  const view = renderHook(
    ({ value }: { value: string }) =>
      useComposerDictation({
        value,
        setValue: (next) => {
          state.value = next
          element.value = next
          view.rerender({ value: next })
        },
        textareaRef: { current: element },
        engine
      }),
    { initialProps: { value: initial } }
  )
  return { result: view.result, element, value: () => state.value }
}

function keyEvent(init: Partial<KeyboardEvent<HTMLElement>>): KeyboardEvent<HTMLElement> {
  return {
    preventDefault: vi.fn(),
    defaultPrevented: false,
    ...init
  } as unknown as KeyboardEvent<HTMLElement>
}

beforeEach(() => {
  tickListeners.length = 0
  stopped = 0
})

afterEach(() => {
  document.body.replaceChildren()
  vi.useRealTimers()
})

describe('useComposerDictation', () => {
  it('lands the transcript at the caret and leaves the caret after it', async () => {
    const harness = mount('revisa o ')
    harness.element.setSelectionRange(9, 9)

    await act(async () => {
      harness.result.current.start()
    })
    await act(async () => {
      emit(100, 0.002)
      emit(2500, 0.4)
      emit(800, 0.002)
    })

    expect(harness.value()).toBe('revisa o ditado')
    // The caret follows the words in, so speaking on continues from there.
    expect(harness.element.selectionStart).toBe(15)
    expect(document.activeElement).toBe(harness.element)
  })

  it('marks the run that just landed, then clears it on its own (VP-R2.3)', async () => {
    vi.useFakeTimers()
    const harness = mount('revisa o ')
    await act(async () => {
      harness.result.current.start()
    })
    await act(async () => {
      emit(100, 0.002)
      emit(2500, 0.4)
      emit(800, 0.002)
    })

    expect(harness.result.current.freshRange).toEqual([9, 15])
    await act(async () => {
      vi.advanceTimersByTime(700)
    })
    // A glance, not a state.
    expect(harness.result.current.freshRange).toBeNull()
  })

  it('does not mark anything when a segment inserts nothing', async () => {
    const harness = mount('intacto', engineReturning('   '))
    await act(async () => {
      harness.result.current.start()
    })
    await act(async () => {
      emit(100, 0.002)
      emit(2500, 0.4)
      emit(800, 0.002)
    })
    expect(harness.result.current.freshRange).toBeNull()
    expect(harness.value()).toBe('intacto')
  })

  it('appends at the end when the field holds no selection at all', async () => {
    const element = document.createElement('textarea')
    const state = { value: 'sem foco' }
    const view = renderHook(() =>
      useComposerDictation({
        value: state.value,
        setValue: (next) => {
          state.value = next
        },
        // A field that was never mounted: `read()` must not guess a caret.
        textareaRef: { current: null },
        engine: engineReturning('ditado')
      })
    )
    void element

    await act(async () => {
      view.result.current.start()
    })
    await act(async () => {
      emit(100, 0.002)
      emit(2500, 0.4)
      emit(800, 0.002)
    })
    expect(state.value).toBe('sem foco ditado')
  })

  describe('composer-scoped keys', () => {
    it('starts a take on the toggle, and concludes rather than discards on the second press', async () => {
      const harness = mount('antes ')
      const press = (): KeyboardEvent<HTMLElement> =>
        keyEvent({ key: 'D', ctrlKey: true, shiftKey: true })

      const first = press()
      await act(async () => {
        harness.result.current.handleKeyDown(first)
      })
      expect(first.preventDefault).toHaveBeenCalled()
      expect(harness.result.current.active).toBe(true)

      await act(async () => {
        emit(100, 0.002)
        emit(2500, 0.4)
      })
      await act(async () => {
        harness.result.current.handleKeyDown(press())
      })
      // Concluded: the take's words are kept (Esc is what throws them away).
      expect(harness.value()).toContain('ditado')
    })

    it('accepts the toggle with Cmd as well as Ctrl', async () => {
      const harness = mount()
      await act(async () => {
        harness.result.current.handleKeyDown(keyEvent({ key: 'd', metaKey: true, shiftKey: true }))
      })
      expect(harness.result.current.active).toBe(true)
    })

    it('ignores other modified keys', async () => {
      const harness = mount()
      for (const key of ['k', 'g', 'b']) {
        await act(async () => {
          harness.result.current.handleKeyDown(keyEvent({ key, ctrlKey: true, shiftKey: true }))
        })
      }
      expect(harness.result.current.active).toBe(false)
    })

    it('discards on Esc, rewinding the draft (VP-R1.5)', async () => {
      const harness = mount('revisa o ')
      await act(async () => {
        harness.result.current.start()
      })
      await act(async () => {
        emit(100, 0.002)
        emit(2500, 0.4)
        emit(800, 0.002)
      })
      expect(harness.value()).toBe('revisa o ditado')

      const escape = keyEvent({ key: 'Escape' })
      await act(async () => {
        harness.result.current.handleKeyDown(escape)
      })
      expect(escape.preventDefault).toHaveBeenCalled()
      expect(harness.value()).toBe('revisa o ')
      expect(stopped).toBe(1)
    })

    it('leaves Esc alone when no take is live, so it keeps its usual meaning', () => {
      const harness = mount()
      const escape = keyEvent({ key: 'Escape' })
      harness.result.current.handleKeyDown(escape)
      expect(escape.preventDefault).not.toHaveBeenCalled()
    })

    // Esc belongs to an open `/` or `#` menu before it belongs to the take.
    it('stands down from an event a menu already claimed', async () => {
      const harness = mount()
      await act(async () => {
        harness.result.current.start()
      })

      const claimed = keyEvent({ key: 'Escape', defaultPrevented: true })
      await act(async () => {
        harness.result.current.handleKeyDown(claimed)
      })
      expect(claimed.preventDefault).not.toHaveBeenCalled()
      expect(harness.result.current.active).toBe(true)
    })
  })

  /**
   * VP-R2.9, and the defect the visual pass caught before any test did.
   *
   * A live pass writes provisional text, the phrase closes, and the segment's
   * real text lands a microtask later — two writes inside one tick. The second
   * one asked the field where the caret was, and the field answered from the
   * DOM, which React had not updated yet. So the real text went in *after* the
   * guess instead of over it and the composer read "revisa o arquivo de
   * configuração. Arquivo de configuração." — the whole phrase, twice.
   */
  it('replaces the live guess with the segment text instead of appending it', async () => {
    const harness = mount('revisa o ', engineSaying('arquivo', 'arquivo de configuração.'))
    harness.element.setSelectionRange(9, 9)

    await act(async () => {
      harness.result.current.start()
    })
    // A second of speech: enough for a live pass, not enough to cut.
    await act(async () => {
      emit(100, 0.002)
      emit(1200, 0.4)
    })
    expect(harness.value()).toBe('revisa o arquivo')
    expect(harness.result.current.previewRange).toEqual([9, 16])

    // …then the phrase ends and the real pass answers.
    await act(async () => {
      emit(2500, 0.4)
      emit(800, 0.002)
    })

    expect(harness.value()).toBe('revisa o arquivo de configuração.')
    expect(harness.result.current.previewRange).toBeNull()
  })

  it('rewinds the provisional text too when the take is discarded', async () => {
    const harness = mount('rascunho ')
    await act(async () => {
      harness.result.current.start()
    })
    await act(async () => {
      emit(100, 0.002)
      emit(1200, 0.4)
    })
    expect(harness.value()).not.toBe('rascunho ')

    await act(async () => {
      harness.result.current.discard()
    })
    expect(harness.value()).toBe('rascunho ')
    expect(harness.result.current.previewRange).toBeNull()
  })
})
