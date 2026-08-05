// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import {
  browserDictationDeps,
  useDictation,
  type DictationDeps,
  type DictationEngine,
  type DictationTarget
} from './useDictation'
import { createSegmenter, DEFAULT_SEGMENTER_CONFIG, type Tick } from './segmenter'
import { CaptureFailure, type Capture } from './micCapture'
import type { WhisperPhase } from '../secondBrain/whisper/useWhisper'

/**
 * The hook, with a fake capture and a fake engine — no WebAudio, no model, no
 * microphone. What is asserted here is the part no screenshot can show: that a
 * take is never lost, and that nothing keeps running after it ends (VP-R4.6).
 */

const RATE = 16_000
const TICK_SAMPLES = 512
const TICK_MS = 32
const QUIET = 0.002
const LOUD = 0.4

function tick(rms: number): Tick {
  return { rms, samples: new Float32Array(TICK_SAMPLES).fill(rms) }
}

/** A target backed by a plain object, the way a real field is backed by state. */
function fakeTarget(
  value = '',
  caret = value.length
): DictationTarget & {
  current: { value: string; selectionStart: number; selectionEnd: number }
  writes: number
} {
  const current = { value, selectionStart: caret, selectionEnd: caret }
  const target = {
    current,
    writes: 0,
    read: () => ({ ...current }),
    write: (next: { value: string; caret: number; range: [number, number] }) => {
      target.writes += 1
      current.value = next.value
      current.selectionStart = next.caret
      current.selectionEnd = next.caret
    }
  }
  return target
}

interface FakeCapture {
  capture: Capture
  stopped: number
  /** Feeds one tick to every registered listener. */
  emit(rms: number): void
  /** Feeds `ms` worth of ticks at one level. */
  emitFor(ms: number, rms: number): void
  pushLevels(levels: number[]): void
}

function fakeCapture(): FakeCapture {
  const tickListeners: ((value: Tick) => void)[] = []
  const levelListeners: ((levels: number[]) => void)[] = []
  const state = {
    stopped: 0,
    capture: {
      onTick: (listener: (value: Tick) => void) => tickListeners.push(listener),
      onLevels: (listener: (levels: number[]) => void) => levelListeners.push(listener),
      stop: () => {
        state.stopped += 1
      }
    } as Capture,
    emit: (rms: number) => {
      for (const listener of tickListeners) listener(tick(rms))
    },
    emitFor: (ms: number, rms: number) => {
      for (let i = 0; i < Math.ceil(ms / TICK_MS); i += 1) state.emit(rms)
    },
    pushLevels: (levels: number[]) => {
      for (const listener of levelListeners) listener(levels)
    }
  }
  return state
}

function fakeEngine(text = '', phase: WhisperPhase = { status: 'idle' }): DictationEngine {
  return { phase, transcribe: async () => text }
}

function fakeDeps(capture: FakeCapture, overrides: Partial<DictationDeps> = {}): DictationDeps {
  return {
    startCapture: async () => capture.capture,
    createSegmenter,
    config: { ...DEFAULT_SEGMENTER_CONFIG, sampleRate: RATE },
    ...overrides
  } as DictationDeps
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

/** Starts a take and settles the async capture open. */
async function startTake(
  result: { current: ReturnType<typeof useDictation> },
  capture: FakeCapture
): Promise<void> {
  await act(async () => {
    result.current.start()
  })
  // The room, before anyone speaks — this is what seeds the noise floor.
  await act(async () => {
    capture.emitFor(100, QUIET)
  })
}

describe('browserDictationDeps', () => {
  it('wires the real segmenter, the measured defaults and the real capture', async () => {
    const deps = browserDictationDeps()
    expect(deps.createSegmenter).toBe(createSegmenter)
    expect(deps.config).toBe(DEFAULT_SEGMENTER_CONFIG)

    // The real `startCapture`, reached through its own injectable seam — so the
    // wiring is exercised without a media stack.
    await expect(
      deps.startCapture({
        getUserMedia: async () => {
          throw Object.assign(new Error('none'), { name: 'NotFoundError' })
        },
        createContext: () => ({}) as AudioContext,
        workletUrl: () => 'file:///w.js',
        createWorkletNode: () => ({}) as AudioWorkletNode
      })
    ).rejects.toMatchObject({ kind: 'unavailable' })
  })
})

describe('useDictation', () => {
  it('reports listening immediately, before the engine is consulted (D-VP-5)', async () => {
    const capture = fakeCapture()
    const target = fakeTarget('revisa o ')
    const { result } = renderHook(() =>
      useDictation(
        target,
        fakeEngine('', { status: 'downloading', pct: 3, file: 'x' }),
        fakeDeps(capture)
      )
    )

    expect(result.current.phase.status).toBe('idle')
    expect(result.current.active).toBe(false)

    await act(async () => {
      result.current.start()
    })
    // Live on the press itself — not after a download, not after a 51 s warm-up.
    expect(result.current.phase.status).toBe('listening')
    expect(result.current.active).toBe(true)
    // And the draft is untouched by starting.
    expect(target.current.value).toBe('revisa o ')
  })

  it('turns the engine’s own progress into the preparing phase (VP-R3.2)', async () => {
    const capture = fakeCapture()
    const engine = fakeEngine('', { status: 'downloading', pct: 41, file: 'encoder.onnx' })
    const { result } = renderHook(() => useDictation(fakeTarget(), engine, fakeDeps(capture)))
    await startTake(result, capture)

    act(() => {
      vi.advanceTimersByTime(250)
    })
    expect(result.current.phase).toMatchObject({
      status: 'preparing',
      engine: { status: 'downloading', pct: 41 }
    })
  })

  // The stale-closure trap: `onTick` is registered once, so a phase read from a
  // closure would freeze at whatever it was when capture opened — and the 51 s
  // warm-up always arrives after that.
  it('picks up an engine phase that changes after capture opened', async () => {
    const capture = fakeCapture()
    let phase: WhisperPhase = { status: 'idle' }
    const { result, rerender } = renderHook(() =>
      useDictation(fakeTarget(), { phase, transcribe: async () => '' }, fakeDeps(capture))
    )
    await startTake(result, capture)
    expect(result.current.phase.status).toBe('listening')

    phase = { status: 'warming' }
    rerender()
    act(() => {
      vi.advanceTimersByTime(250)
    })
    expect(result.current.phase).toMatchObject({
      status: 'preparing',
      engine: { status: 'warming' }
    })
  })

  it('counts the elapsed seconds and the running silence', async () => {
    const capture = fakeCapture()
    const { result } = renderHook(() => useDictation(fakeTarget(), fakeEngine(), fakeDeps(capture)))
    await startTake(result, capture)

    await act(async () => {
      capture.emitFor(2500, LOUD)
      vi.advanceTimersByTime(2600)
    })
    expect(result.current.phase).toMatchObject({ status: 'listening' })
    // Silence resets on speech, so it reads zero while the user is talking.
    expect((result.current.phase as { silentMs: number }).silentMs).toBe(0)

    await act(async () => {
      capture.emitFor(1000, QUIET)
    })
    expect((result.current.phase as { silentMs: number }).silentMs).toBeGreaterThanOrEqual(1000)
  })

  it('counts a segment as pending the moment the segmenter cuts it', async () => {
    const capture = fakeCapture()
    // An engine that never settles, so the segment stays in the queue where the
    // assertion can see it — with an instant engine it would already be written.
    const engine: DictationEngine = {
      phase: { status: 'idle' },
      transcribe: () => new Promise(() => {})
    }
    const { result } = renderHook(() => useDictation(fakeTarget(), engine, fakeDeps(capture)))
    await startTake(result, capture)

    await act(async () => {
      capture.emitFor(2500, LOUD)
      capture.emitFor(800, QUIET)
    })
    expect((result.current.phase as { pending: number }).pending).toBe(1)
  })

  it('finalizes itself after the autostop silence, with capture released (VP-R4.2)', async () => {
    const capture = fakeCapture()
    const { result } = renderHook(() => useDictation(fakeTarget(), fakeEngine(), fakeDeps(capture)))
    await startTake(result, capture)

    await act(async () => {
      capture.emitFor(2500, LOUD)
    })
    await act(async () => {
      capture.emitFor(DEFAULT_SEGMENTER_CONFIG.autoStopMs + 100, QUIET)
    })

    // Never left open: the microphone is released by the automatic stop too.
    expect(capture.stopped).toBe(1)
    // This engine transcribes instantly, so the queue is already drained by the
    // time the stop lands and the take is simply over.
    expect(result.current.phase.status).toBe('idle')
  })

  it('shows the drain while the queue still has work, then settles (VP-R1.4)', async () => {
    const capture = fakeCapture()
    let settle: ((text: string) => void) | undefined
    const engine: DictationEngine = {
      phase: { status: 'idle' },
      transcribe: () =>
        new Promise<string>((resolve) => {
          settle = resolve
        })
    }
    const target = fakeTarget('revisa o ')
    const { result } = renderHook(() => useDictation(target, engine, fakeDeps(capture)))
    await startTake(result, capture)

    await act(async () => {
      capture.emitFor(2500, LOUD)
      capture.emitFor(800, QUIET)
    })
    act(() => {
      result.current.finish()
    })
    // Still transcribing: the transport says so instead of pretending it is done.
    expect(result.current.phase).toMatchObject({ status: 'finalizing', pending: 1 })

    await act(async () => {
      settle?.('arquivo de configuração')
    })
    expect(target.current.value).toBe('revisa o arquivo de configuração')
    expect(result.current.phase.status).toBe('idle')
  })

  it('flushes the trailing phrase on finish, so Concluir never drops it (VP-R1.4)', async () => {
    const capture = fakeCapture()
    const { result } = renderHook(() => useDictation(fakeTarget(), fakeEngine(), fakeDeps(capture)))
    await startTake(result, capture)

    // A phrase too short for the segmenter to cut on its own.
    await act(async () => {
      capture.emitFor(600, LOUD)
    })
    expect((result.current.phase as { pending: number }).pending).toBe(0)

    act(() => {
      result.current.finish()
    })
    expect(result.current.phase).toMatchObject({ status: 'finalizing', pending: 1 })
    expect(capture.stopped).toBe(1)
  })

  it('restores the exact pre-dictation value AND caret on discard (D-VP-9)', async () => {
    const capture = fakeCapture()
    const target = fakeTarget('revisa o arquivo', 9)
    const { result } = renderHook(() => useDictation(target, fakeEngine(), fakeDeps(capture)))
    await startTake(result, capture)

    // The take happened, and something else moved the field meanwhile.
    await act(async () => {
      capture.emitFor(2500, LOUD)
      capture.emitFor(800, QUIET)
    })
    target.write({ value: 'revisa o texto todo', caret: 19, range: [9, 19] })

    act(() => {
      result.current.discard()
    })

    expect(target.current.value).toBe('revisa o arquivo')
    expect(target.current.selectionStart).toBe(9)
    expect(result.current.phase.status).toBe('idle')
    expect(result.current.active).toBe(false)
    expect(capture.stopped).toBe(1)
  })

  it('discards nothing when there was never a take', () => {
    const target = fakeTarget('intacto')
    const capture = fakeCapture()
    const { result } = renderHook(() => useDictation(target, fakeEngine(), fakeDeps(capture)))

    act(() => {
      result.current.discard()
    })
    expect(target.writes).toBe(0)
    expect(target.current.value).toBe('intacto')
  })

  it('stops every capture and timer on unmount (VP-R4.6)', async () => {
    const capture = fakeCapture()
    const { result, unmount } = renderHook(() =>
      useDictation(fakeTarget(), fakeEngine(), fakeDeps(capture))
    )
    await startTake(result, capture)

    unmount()
    expect(capture.stopped).toBe(1)
    // Nothing keeps ticking after the component is gone.
    expect(() => vi.advanceTimersByTime(5000)).not.toThrow()
  })

  // The race that re-opens a microphone the user already closed.
  it('stops a capture that resolves after the take was discarded', async () => {
    const capture = fakeCapture()
    let resolveCapture: ((value: Capture) => void) | undefined
    const { result } = renderHook(() =>
      useDictation(
        fakeTarget(),
        fakeEngine(),
        fakeDeps(capture, {
          startCapture: () =>
            new Promise<Capture>((resolve) => {
              resolveCapture = resolve
            })
        })
      )
    )

    act(() => {
      result.current.start()
    })
    act(() => {
      result.current.discard()
    })

    await act(async () => {
      resolveCapture?.(capture.capture)
    })

    // Opened late, stopped immediately — and dictation stays idle.
    expect(capture.stopped).toBe(1)
    expect(result.current.phase.status).toBe('idle')
  })

  it('ignores a second press while the first is still opening', async () => {
    const capture = fakeCapture()
    let opens = 0
    const { result } = renderHook(() =>
      useDictation(
        fakeTarget(),
        fakeEngine(),
        fakeDeps(capture, {
          startCapture: async () => {
            opens += 1
            return capture.capture
          }
        })
      )
    )

    await act(async () => {
      result.current.start()
      result.current.start()
      result.current.start()
    })
    expect(opens).toBe(1)

    // And once open, pressing again is still a no-op rather than a second mic.
    await act(async () => {
      result.current.start()
    })
    expect(opens).toBe(1)
  })

  it('reports a refused microphone without touching the draft (VP-R4.3)', async () => {
    const capture = fakeCapture()
    const target = fakeTarget('meu rascunho')
    const { result } = renderHook(() =>
      useDictation(
        target,
        fakeEngine(),
        fakeDeps(capture, {
          startCapture: async () => {
            throw new CaptureFailure('denied')
          }
        })
      )
    )

    await act(async () => {
      result.current.start()
    })

    expect(result.current.phase).toEqual({ status: 'error', kind: 'denied' })
    expect(target.current.value).toBe('meu rascunho')
    expect(target.writes).toBe(0)
  })

  it('distinguishes a missing device from a refusal', async () => {
    const capture = fakeCapture()
    const { result } = renderHook(() =>
      useDictation(
        fakeTarget(),
        fakeEngine(),
        fakeDeps(capture, {
          startCapture: async () => {
            throw new CaptureFailure('unavailable')
          }
        })
      )
    )
    await act(async () => {
      result.current.start()
    })
    expect(result.current.phase).toMatchObject({ kind: 'unavailable' })
  })

  it('treats an unexpected failure as denied rather than inventing a cause', async () => {
    const capture = fakeCapture()
    const { result } = renderHook(() =>
      useDictation(
        fakeTarget(),
        fakeEngine(),
        fakeDeps(capture, {
          startCapture: async () => {
            throw new Error('something else entirely')
          }
        })
      )
    )
    await act(async () => {
      result.current.start()
    })
    expect(result.current.phase).toMatchObject({ status: 'error', kind: 'denied' })
  })

  it('publishes the live meter levels and clears them when the take ends', async () => {
    const capture = fakeCapture()
    const { result } = renderHook(() => useDictation(fakeTarget(), fakeEngine(), fakeDeps(capture)))
    await startTake(result, capture)

    act(() => {
      capture.pushLevels([0.1, 0.5, 0.9])
    })
    expect(result.current.levels).toEqual([0.1, 0.5, 0.9])

    act(() => {
      result.current.finish()
    })
    expect(result.current.levels).toEqual([])
  })

  // ---- T7: the queue, as the composer actually experiences it --------------

  it('lands a transcribed phrase at the caret while the take continues (VP-R2.1-2.2)', async () => {
    const capture = fakeCapture()
    const target = fakeTarget('revisa o ')
    const { result } = renderHook(() =>
      useDictation(target, fakeEngine('arquivo'), fakeDeps(capture))
    )
    await startTake(result, capture)

    await act(async () => {
      capture.emitFor(2500, LOUD)
      capture.emitFor(800, QUIET)
    })

    // Joined to what was typed, no doubled space — and capture is still open.
    expect(target.current.value).toBe('revisa o arquivo')
    expect(result.current.phase.status).toBe('listening')
    expect(capture.stopped).toBe(0)
  })

  it('inserts everything captured while the engine was cold, in spoken order (VP-R3.1-3.3)', async () => {
    const capture = fakeCapture()
    const target = fakeTarget()
    const settlers: ((text: string) => void)[] = []
    const engine: DictationEngine = {
      phase: { status: 'warming' },
      transcribe: () => new Promise<string>((resolve) => settlers.push(resolve))
    }
    const { result } = renderHook(() => useDictation(target, engine, fakeDeps(capture)))
    await startTake(result, capture)

    // Three phrases spoken while the pipeline is still building its session.
    for (let i = 0; i < 3; i += 1) {
      await act(async () => {
        capture.emitFor(2500, LOUD)
        capture.emitFor(800, QUIET)
      })
    }
    act(() => {
      vi.advanceTimersByTime(250)
    })
    expect(result.current.phase).toMatchObject({ status: 'preparing', pending: 3 })
    expect(target.current.value).toBe('')

    // The engine warms up: nothing spoken was lost, and the order is the spoken one.
    await act(async () => {
      settlers[0]('Primeira.')
    })
    await act(async () => {
      settlers[1]('Segunda.')
    })
    await act(async () => {
      settlers[2]('Terceira.')
    })
    expect(target.current.value).toBe('Primeira. Segunda. Terceira.')
  })

  it('surfaces a segment failure while capture continues, and retries the same audio (VP-R4.4)', async () => {
    const capture = fakeCapture()
    const target = fakeTarget()
    let attempt = 0
    const engine: DictationEngine = {
      phase: { status: 'idle' },
      transcribe: async () => {
        attempt += 1
        if (attempt === 1) throw new Error('sessão falhou')
        return 'recuperada'
      }
    }
    const { result } = renderHook(() => useDictation(target, engine, fakeDeps(capture)))
    await startTake(result, capture)

    await act(async () => {
      capture.emitFor(2500, LOUD)
      capture.emitFor(800, QUIET)
    })

    // Visible, and the microphone is STILL open — the take is not over.
    expect(result.current.failure).toBe('sessão falhou')
    expect(result.current.phase.status).toBe('listening')
    expect(capture.stopped).toBe(0)

    await act(async () => {
      result.current.retry()
    })
    expect(result.current.failure).toBeNull()
    expect(target.current.value).toBe('Recuperada')
  })

  it('rests in the error phase when a take ends with a failure unresolved', async () => {
    const capture = fakeCapture()
    const engine: DictationEngine = {
      phase: { status: 'idle' },
      transcribe: async () => {
        throw new Error('modelo sumiu')
      }
    }
    const { result } = renderHook(() => useDictation(fakeTarget(), engine, fakeDeps(capture)))
    await startTake(result, capture)

    await act(async () => {
      capture.emitFor(600, LOUD)
    })
    await act(async () => {
      result.current.finish()
    })

    expect(result.current.phase).toMatchObject({
      status: 'error',
      kind: 'engine',
      message: 'modelo sumiu'
    })
    expect(result.current.failure).toBe('modelo sumiu')
  })

  it('never writes a result that resolves after the user discarded (VP-R1.5)', async () => {
    const capture = fakeCapture()
    const target = fakeTarget('rascunho')
    let settle: ((text: string) => void) | undefined
    const engine: DictationEngine = {
      phase: { status: 'idle' },
      transcribe: () =>
        new Promise<string>((resolve) => {
          settle = resolve
        })
    }
    const { result } = renderHook(() => useDictation(target, engine, fakeDeps(capture)))
    await startTake(result, capture)

    await act(async () => {
      capture.emitFor(2500, LOUD)
      capture.emitFor(800, QUIET)
    })
    act(() => {
      result.current.discard()
    })

    await act(async () => {
      settle?.('texto fantasma')
    })
    // The composer was rewound; a late result must not resurrect the take.
    expect(target.current.value).toBe('rascunho')
    expect(result.current.phase.status).toBe('idle')
  })

  it('pre-warms only on intent, only once, and never during a take (D-VP-6)', async () => {
    const capture = fakeCapture()
    const transcribe = vi.fn<(pcm: Float32Array) => Promise<string>>(async () => '')
    const { result } = renderHook(() =>
      useDictation(fakeTarget(), { phase: { status: 'idle' }, transcribe }, fakeDeps(capture))
    )

    // Nothing at mount: a user who never dictates downloads nothing.
    expect(transcribe).not.toHaveBeenCalled()

    await act(async () => {
      result.current.prewarm()
    })
    expect(transcribe).toHaveBeenCalledTimes(1)
    // Silence, not a take.
    const prewarmPcm = transcribe.mock.calls[0][0]
    expect(prewarmPcm.length).toBeGreaterThan(0)
    expect([...prewarmPcm].every((sample) => sample === 0)).toBe(true)

    // Hovering again costs nothing.
    await act(async () => {
      result.current.prewarm()
    })
    expect(transcribe).toHaveBeenCalledTimes(1)

    // And it never steals the single pipeline slot from a live take.
    await startTake(result, capture)
    await act(async () => {
      result.current.prewarm()
    })
    expect(transcribe).toHaveBeenCalledTimes(1)
  })

  it('lets a failed pre-warm be retried on the next intent', async () => {
    const capture = fakeCapture()
    const transcribe = vi.fn().mockRejectedValueOnce(new Error('rede caiu')).mockResolvedValue('')
    const { result } = renderHook(() =>
      useDictation(fakeTarget(), { phase: { status: 'idle' }, transcribe }, fakeDeps(capture))
    )

    await act(async () => {
      result.current.prewarm()
    })
    await act(async () => {
      result.current.prewarm()
    })
    expect(transcribe).toHaveBeenCalledTimes(2)
  })
})
