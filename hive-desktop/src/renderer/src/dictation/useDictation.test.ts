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
import { DEFAULT_LIVE_PASS_CONFIG } from './livePass'
import { createSegmenter, DEFAULT_SEGMENTER_CONFIG, type Tick } from './segmenter'
import { CaptureFailure, type Capture } from './micCapture'
import { WhisperMemoryError } from '../secondBrain/whisper/whisperClient'
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
  return { phase, transcribe: async () => text, warm: async () => {} }
}

/**
 * Live passes off.
 *
 * The default is on, and most of what is asserted here is about the *queue* —
 * ordering, cold-start buffering, one bad segment not ending a take. A live
 * pass calls the same engine for a different reason, so leaving it on would
 * make those tests count calls that are not theirs. The behaviour it turns off
 * has its own block at the bottom of this file.
 */
const NO_LIVE_PASS = { minSpeechMs: Infinity, growthMs: Infinity, failureBudget: 0 }

function fakeDeps(capture: FakeCapture, overrides: Partial<DictationDeps> = {}): DictationDeps {
  return {
    startCapture: async () => capture.capture,
    createSegmenter,
    config: { ...DEFAULT_SEGMENTER_CONFIG, sampleRate: RATE },
    livePass: NO_LIVE_PASS,
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
    expect(deps.livePass).toBe(DEFAULT_LIVE_PASS_CONFIG)

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
      useDictation(
        fakeTarget(),
        { phase, transcribe: async () => '', warm: async () => {} },
        fakeDeps(capture)
      )
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
      transcribe: () => new Promise(() => {}),
      warm: async () => {}
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
        }),
      warm: async () => {}
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
      transcribe: () => new Promise<string>((resolve) => settlers.push(resolve)),
      warm: async () => {}
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
      },
      warm: async () => {}
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
      },
      warm: async () => {}
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
        }),
      warm: async () => {}
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

  /**
   * D-VP-6, rewritten by the streaming work.
   *
   * Pre-warming used to mean pushing a tenth of a second of fake silence
   * through `transcribe`, which is why it had to be refused during a take: it
   * competed for the single pipeline slot the take itself needed. It is now a
   * real `warm()` on the engine — a session build, no audio, chained behind
   * whatever is running and idempotent inside the process-wide client. So the
   * rules this asserts are the new ones: nothing at mount, a build on intent,
   * no fake audio, and **allowed** mid-take.
   */
  it('pre-warms on intent, without pushing audio through the engine (D-VP-6)', async () => {
    const capture = fakeCapture()
    const transcribe = vi.fn<(pcm: Float32Array) => Promise<string>>(async () => '')
    const warm = vi.fn(async () => {})
    const { result } = renderHook(() =>
      useDictation(fakeTarget(), { phase: { status: 'idle' }, transcribe, warm }, fakeDeps(capture))
    )

    // Nothing at mount: a user who never dictates downloads nothing.
    expect(warm).not.toHaveBeenCalled()

    await act(async () => {
      result.current.prewarm()
    })
    expect(warm).toHaveBeenCalledTimes(1)
    // A build, never a transcription — the old trick cost a full inference pass.
    expect(transcribe).not.toHaveBeenCalled()
  })

  /**
   * Pressing the microphone is the clearest statement of intent there is, and
   * it is the path hover cannot cover: the keyboard toggle, the shortcut, and
   * the model gate's remembered intent after a download all used to reach a
   * cold engine and pay the whole session build with the first phrase.
   */
  it('starts warming the moment capture starts, not when the first phrase is ready', async () => {
    const capture = fakeCapture()
    const warm = vi.fn(async () => {})
    const { result } = renderHook(() =>
      useDictation(
        fakeTarget(),
        { phase: { status: 'idle' }, transcribe: async () => '', warm },
        fakeDeps(capture)
      )
    )

    await startTake(result, capture)
    expect(warm).toHaveBeenCalled()
  })

  it('a failed pre-warm is swallowed — the user has not asked for anything yet', async () => {
    const capture = fakeCapture()
    const warm = vi.fn().mockRejectedValue(new Error('rede caiu'))
    const { result } = renderHook(() =>
      useDictation(
        fakeTarget(),
        { phase: { status: 'idle' }, transcribe: async () => '', warm },
        fakeDeps(capture)
      )
    )

    await act(async () => {
      result.current.prewarm()
    })
    expect(result.current.phase.status).toBe('idle')
  })

  /** The partial text the transport shows, relayed from the engine. */
  it('exposes the running partial of the segment being transcribed', async () => {
    const capture = fakeCapture()
    let report: ((text: string) => void) | undefined
    let settle: ((text: string) => void) | undefined
    const engine: DictationEngine = {
      phase: { status: 'idle' },
      transcribe: (_pcm, options) =>
        new Promise<string>((resolve) => {
          report = options?.onPartial
          settle = resolve
        }),
      warm: async () => {}
    }
    const { result } = renderHook(() => useDictation(fakeTarget(), engine, fakeDeps(capture)))
    await startTake(result, capture)

    await act(async () => {
      capture.emitFor(2500, LOUD)
      capture.emitFor(800, QUIET)
    })
    await act(async () => {
      report?.('olá squ')
    })
    expect(result.current.partial).toBe('olá squ')

    // Once the segment is written, the provisional line goes: leaving it would
    // show the same words twice.
    await act(async () => {
      settle?.('olá squad')
    })
    expect(result.current.partial).toBe('')
  })
  /**
   * The complaint, in one block: *"não deveria o usuário ter que terminar tudo
   * para só depois transcrever"*. Segments are cut by silence or by the 9 s
   * ceiling, so a speaker in full flow used to see nothing at all until one of
   * those happened. Now the phrase is transcribed while it is still being
   * spoken, and the result sits in the field as a provisional run.
   */
  describe('live transcription of the phrase being spoken (VP-R2.9)', () => {
    const LIVE = { minSpeechMs: 900, growthMs: 1200, failureBudget: 2 }

    it('writes into the field mid-phrase, long before any segment is cut', async () => {
      const capture = fakeCapture()
      const target = fakeTarget()
      const engine: DictationEngine = {
        phase: { status: 'idle' },
        transcribe: async () => 'estou falando agora',
        warm: async () => {}
      }
      const { result } = renderHook(() =>
        useDictation(target, engine, fakeDeps(capture, { livePass: LIVE }))
      )
      await startTake(result, capture)

      // One second of speech: below `minSpeechMs` (2 s) for a cut, and with no
      // silence at all, so the segmenter has produced nothing.
      await act(async () => {
        capture.emitFor(1000, LOUD)
      })

      expect(target.current.value).toBe('Estou falando agora')
      expect(result.current.previewRange).not.toBeNull()
      expect(result.current.phase.status).toBe('listening')
    })

    it('replaces the guess with the segment own text, and stops marking it', async () => {
      const capture = fakeCapture()
      const target = fakeTarget()
      let call = 0
      const engine: DictationEngine = {
        phase: { status: 'idle' },
        transcribe: async () => (call++ === 0 ? 'estou falando' : 'Estou falando agora.'),
        warm: async () => {}
      }
      const { result } = renderHook(() =>
        useDictation(target, engine, fakeDeps(capture, { livePass: LIVE }))
      )
      await startTake(result, capture)

      await act(async () => {
        capture.emitFor(1000, LOUD)
      })
      expect(target.current.value).toBe('Estou falando')

      // Speech continues past the 2 s minimum, then a pause closes the phrase.
      await act(async () => {
        capture.emitFor(1600, LOUD)
        capture.emitFor(800, QUIET)
      })

      // No doubled words: the guess came out before the real text went in.
      expect(target.current.value).toBe('Estou falando agora.')
      expect(result.current.previewRange).toBeNull()
    })

    it('joins the guess to what was already typed, without eating it', async () => {
      const capture = fakeCapture()
      const target = fakeTarget('revisa o ')
      const engine: DictationEngine = {
        phase: { status: 'idle' },
        transcribe: async () => 'arquivo',
        warm: async () => {}
      }
      const { result } = renderHook(() =>
        useDictation(target, engine, fakeDeps(capture, { livePass: LIVE }))
      )
      await startTake(result, capture)
      await act(async () => {
        capture.emitFor(1000, LOUD)
      })
      expect(target.current.value).toBe('revisa o arquivo')
      expect(result.current.previewRange).toEqual([9, 16])
    })

    it('takes the guess back out when the take is discarded (VP-R1.5, D-VP-9)', async () => {
      const capture = fakeCapture()
      const target = fakeTarget('rascunho')
      const engine: DictationEngine = {
        phase: { status: 'idle' },
        transcribe: async () => 'texto provisorio',
        warm: async () => {}
      }
      const { result } = renderHook(() =>
        useDictation(target, engine, fakeDeps(capture, { livePass: LIVE }))
      )
      await startTake(result, capture)
      await act(async () => {
        capture.emitFor(1000, LOUD)
      })
      expect(target.current.value).not.toBe('rascunho')

      await act(async () => {
        result.current.discard()
      })
      expect(target.current.value).toBe('rascunho')
      expect(result.current.previewRange).toBeNull()
    })

    // The engine has one slot. A guess that delays the segment covering the
    // same words has made the feature worse, not better.
    it('never takes the pipeline while a real segment is being transcribed', async () => {
      const capture = fakeCapture()
      const target = fakeTarget()
      const settlers: ((text: string) => void)[] = []
      const engine: DictationEngine = {
        phase: { status: 'idle' },
        transcribe: () => new Promise<string>((resolve) => settlers.push(resolve)),
        warm: async () => {}
      }
      const { result } = renderHook(() =>
        useDictation(target, engine, fakeDeps(capture, { livePass: LIVE }))
      )
      await startTake(result, capture)

      // A first phrase, cut and now in flight — one call, unanswered.
      await act(async () => {
        capture.emitFor(2500, LOUD)
        capture.emitFor(800, QUIET)
      })
      const inFlight = settlers.length

      // Someone keeps talking straight through it. No second call is made.
      await act(async () => {
        capture.emitFor(2000, LOUD)
      })
      expect(settlers).toHaveLength(inFlight)
    })
  })

  /**
   * The failure a real take actually hits, and the only one where "tente de
   * novo" is bad advice: onnxruntime's WebAssembly memory grows and is never
   * given back, so the next attempt meets the same ceiling. What changes the
   * outcome is a smaller model, and that is what the user has to be told —
   * "failed to call OrtRun(). ERROR_CODE: 6, ERROR_MESSAGE: std::bad_alloc" is
   * not a sentence anyone can act on.
   */
  it('turns an out-of-memory failure into advice the user can act on', async () => {
    const capture = fakeCapture()
    const engine: DictationEngine = {
      phase: { status: 'idle' },
      transcribe: async () => {
        throw new WhisperMemoryError(
          'failed to call OrtRun(). ERROR_CODE: 6, ERROR_MESSAGE: std::bad_alloc'
        )
      },
      warm: async () => {}
    }
    const { result } = renderHook(() => useDictation(fakeTarget(), engine, fakeDeps(capture)))
    await startTake(result, capture)

    await act(async () => {
      capture.emitFor(2500, LOUD)
      capture.emitFor(800, QUIET)
    })

    expect(result.current.failure).toBe(
      'Faltou memória para rodar esse modelo. Escolha um modelo menor em Voz e transcrição.'
    )
  })

  it('leaves every other failure in the engine own words', async () => {
    const capture = fakeCapture()
    const engine: DictationEngine = {
      phase: { status: 'idle' },
      transcribe: async () => {
        throw new Error('sessão falhou')
      },
      warm: async () => {}
    }
    const { result } = renderHook(() => useDictation(fakeTarget(), engine, fakeDeps(capture)))
    await startTake(result, capture)
    await act(async () => {
      capture.emitFor(2500, LOUD)
      capture.emitFor(800, QUIET)
    })
    expect(result.current.failure).toBe('sessão falhou')
  })
})
