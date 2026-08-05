import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  browserCaptureDeps,
  CAPTURE_SAMPLE_RATE,
  CaptureFailure,
  captureErrorKind,
  startCapture,
  type CaptureDeps
} from './micCapture'
import type { Tick } from './segmenter'

/**
 * No WebAudio, no `MediaStream`, no jsdom media stack — every dependency is
 * injected, which is what lets the load-bearing assertion (a stopped capture
 * leaves NOTHING running, on every exit path — VP-R4.6) be made at all.
 */

interface FakeTrack {
  stop: ReturnType<typeof vi.fn>
  readyState: string
}

function fakeStream(trackCount = 2): { stream: MediaStream; tracks: FakeTrack[] } {
  const tracks: FakeTrack[] = Array.from({ length: trackCount }, () => ({
    stop: vi.fn(function (this: FakeTrack) {
      this.readyState = 'ended'
    }),
    readyState: 'live'
  }))
  return { stream: { getTracks: () => tracks } as unknown as MediaStream, tracks }
}

interface FakeGraph {
  deps: CaptureDeps
  tracks: FakeTrack[]
  close: ReturnType<typeof vi.fn>
  addModule: ReturnType<typeof vi.fn>
  createdContexts: number[]
  /** Pushes one tick through the worklet's message port. */
  emitTick(tick: Tick): void
  /** What the analyser will report on the next meter sample. */
  setFrame(fill: number): void
  gain: { value: number }
  connections: string[]
}

function fakeGraph(overrides: Partial<CaptureDeps> = {}, trackCount = 2): FakeGraph {
  const { stream, tracks } = fakeStream(trackCount)
  const close = vi.fn()
  const addModule = vi.fn(async () => undefined)
  const createdContexts: number[] = []
  const connections: string[] = []
  const gain = { value: 1 }
  let frameFill = 0
  let onmessage: ((event: MessageEvent<Tick>) => void) | null = null

  const analyser = {
    fftSize: 0,
    getFloatTimeDomainData: (frame: Float32Array) => frame.fill(frameFill),
    connect: () => undefined
  }
  const node = {
    port: {
      get onmessage() {
        return onmessage
      },
      set onmessage(handler: ((event: MessageEvent<Tick>) => void) | null) {
        onmessage = handler
      }
    },
    connect: (target: unknown) => {
      connections.push('node→gain')
      return target
    }
  }
  const context = {
    audioWorklet: { addModule },
    createMediaStreamSource: () => ({
      connect: (target: unknown) => {
        connections.push(target === analyser ? 'source→analyser' : 'source→node')
      }
    }),
    createAnalyser: () => analyser,
    createGain: () => ({
      gain,
      connect: () => {
        connections.push('gain→destination')
      }
    }),
    destination: {},
    close
  }

  return {
    deps: {
      getUserMedia: async () => stream,
      createContext: (sampleRate: number) => {
        createdContexts.push(sampleRate)
        return context as unknown as AudioContext
      },
      workletUrl: () => 'file:///app/dictation-tick.worklet.js',
      createWorkletNode: () => node as unknown as AudioWorkletNode,
      ...overrides
    },
    tracks,
    close,
    addModule,
    createdContexts,
    emitTick: (tick) => onmessage?.({ data: tick } as MessageEvent<Tick>),
    setFrame: (fill) => {
      frameFill = fill
    },
    gain,
    connections
  }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('captureErrorKind', () => {
  it('tells a missing device apart from a refused permission (VP-R4.3)', () => {
    expect(captureErrorKind({ name: 'NotFoundError' })).toBe('unavailable')
    expect(captureErrorKind({ name: 'DevicesNotFoundError' })).toBe('unavailable')
    expect(captureErrorKind({ name: 'NotAllowedError' })).toBe('denied')
    // Anything unrecognized is treated as denied: it is the actionable message,
    // and "no microphone found" would be a guess.
    expect(captureErrorKind(new Error('boom'))).toBe('denied')
    expect(captureErrorKind(null)).toBe('denied')
    expect(captureErrorKind(undefined)).toBe('denied')
  })
})

describe('browserCaptureDeps', () => {
  // The real wiring is one line per dependency, and each line is the kind that
  // fails silently in production and never in a test — so the globals are
  // stubbed and every one is actually invoked.
  it('wires each dependency to the browser API it stands for', () => {
    const constraints = { audio: true }
    const getUserMedia = vi.fn(async () => fakeStream().stream)
    const contextArgs: unknown[] = []
    const nodeArgs: unknown[] = []

    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } })
    vi.stubGlobal('document', { baseURI: 'file:///app/out/renderer/index.html' })
    vi.stubGlobal(
      'AudioContext',
      class {
        constructor(options: unknown) {
          contextArgs.push(options)
        }
      }
    )
    vi.stubGlobal(
      'AudioWorkletNode',
      class {
        constructor(context: unknown, name: unknown) {
          nodeArgs.push([context, name])
        }
      }
    )

    const deps = browserCaptureDeps()
    void deps.getUserMedia(constraints)
    deps.createContext(CAPTURE_SAMPLE_RATE)
    deps.createWorkletNode({} as AudioContext, 'dictation-tick')

    expect(getUserMedia).toHaveBeenCalledWith(constraints)
    expect(contextArgs).toEqual([{ sampleRate: CAPTURE_SAMPLE_RATE }])
    expect(nodeArgs).toEqual([[{}, 'dictation-tick']])
    // Same-origin, resolved against the document — the CSP reason this asset is
    // copied into the renderer output instead of served over `hive-model:`.
    expect(deps.workletUrl()).toBe('file:///app/out/renderer/dictation-tick.worklet.js')

    vi.unstubAllGlobals()
  })
})

describe('startCapture', () => {
  it('builds the graph the T1 spike settled: 16 kHz, mono, EC/NS/AGC, worklet', async () => {
    const graph = fakeGraph()
    const getUserMedia = vi.spyOn(graph.deps, 'getUserMedia')
    await startCapture(graph.deps)

    expect(getUserMedia).toHaveBeenCalledWith({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    })
    // The context is asked for 16 kHz directly — no resample step exists.
    expect(graph.createdContexts).toEqual([CAPTURE_SAMPLE_RATE])
    expect(graph.addModule).toHaveBeenCalledWith('file:///app/dictation-tick.worklet.js')
    expect(graph.connections).toContain('source→analyser')
    expect(graph.connections).toContain('source→node')
    // Routed to the destination through a SILENT gain: the take is never played
    // back into the room.
    expect(graph.connections).toContain('gain→destination')
    expect(graph.gain.value).toBe(0)
  })

  it('forwards the worklet ticks untouched — the segmenter owns their meaning', async () => {
    const graph = fakeGraph()
    const capture = await startCapture(graph.deps)
    const seen: Tick[] = []
    capture.onTick((tick) => seen.push(tick))

    const tick = { rms: 0.3, samples: new Float32Array([0.1, 0.2]) }
    graph.emitTick(tick)
    expect(seen).toEqual([tick])
  })

  it('delivers every listener a growing, bounded level history', async () => {
    const graph = fakeGraph()
    const capture = await startCapture(graph.deps)
    const first: number[][] = []
    const second: number[][] = []
    capture.onLevels((levels) => first.push(levels))
    capture.onLevels((levels) => second.push(levels))

    graph.setFrame(0.25)
    vi.advanceTimersByTime(150)

    expect(first).toHaveLength(3)
    expect(second).toHaveLength(3)
    // 0.25 RMS scaled ×4 fills the meter — ordinary speech must not read as a
    // flat bar.
    expect(first[0]).toEqual([1])
    expect(first[2]).toHaveLength(3)

    // Bounded: a long take does not grow the array without limit.
    vi.advanceTimersByTime(5000)
    expect(first[first.length - 1].length).toBeLessThanOrEqual(24)
  })

  it('reports silence as a flat zero level rather than idle decoration', async () => {
    const graph = fakeGraph()
    const capture = await startCapture(graph.deps)
    const seen: number[][] = []
    capture.onLevels((levels) => seen.push(levels))

    graph.setFrame(0)
    vi.advanceTimersByTime(100)
    expect(seen[seen.length - 1].every((level) => level === 0)).toBe(true)
  })

  it('stop() stops EVERY track and closes the context (VP-R4.6)', async () => {
    const graph = fakeGraph()
    const capture = await startCapture(graph.deps)
    const levels: number[][] = []
    capture.onLevels((value) => levels.push(value))

    capture.stop()

    // Every track — a single survivor keeps the OS microphone indicator lit.
    expect(graph.tracks).toHaveLength(2)
    for (const track of graph.tracks) {
      expect(track.stop).toHaveBeenCalledTimes(1)
      expect(track.readyState).toBe('ended')
    }
    expect(graph.close).toHaveBeenCalledTimes(1)

    // And the meter timer is gone: no work continues after a stop.
    vi.advanceTimersByTime(1000)
    expect(levels).toHaveLength(0)
  })

  it('stop() is idempotent — a double stop does not re-stop or re-close', async () => {
    const graph = fakeGraph()
    const capture = await startCapture(graph.deps)
    capture.stop()
    capture.stop()
    capture.stop()

    for (const track of graph.tracks) expect(track.stop).toHaveBeenCalledTimes(1)
    expect(graph.close).toHaveBeenCalledTimes(1)
  })

  it('releases nothing-left-running when getUserMedia is refused', async () => {
    const denied = Object.assign(new Error('no'), { name: 'NotAllowedError' })
    const graph = fakeGraph({
      getUserMedia: async () => {
        throw denied
      }
    })

    await expect(startCapture(graph.deps)).rejects.toBeInstanceOf(CaptureFailure)
    await expect(startCapture(graph.deps)).rejects.toMatchObject({ kind: 'denied' })
    // It never got as far as a context, and no track was ever held.
    expect(graph.close).not.toHaveBeenCalled()
  })

  it('reports a missing device as unavailable, not as a refusal', async () => {
    const graph = fakeGraph({
      getUserMedia: async () => {
        throw Object.assign(new Error('none'), { name: 'NotFoundError' })
      }
    })
    await expect(startCapture(graph.deps)).rejects.toMatchObject({ kind: 'unavailable' })
  })

  // The exit path that leaks if teardown lives in the happy path only: the
  // microphone is already open when the worklet fails to load.
  it('stops the already-open track when the worklet fails to load', async () => {
    const graph = fakeGraph()
    graph.addModule.mockRejectedValue(new Error('CSP refused the module'))

    await expect(startCapture(graph.deps)).rejects.toBeInstanceOf(CaptureFailure)
    for (const track of graph.tracks) expect(track.stop).toHaveBeenCalledTimes(1)
    expect(graph.close).toHaveBeenCalledTimes(1)
  })

  it('keeps a CaptureFailure thrown from inside intact instead of re-wrapping it', async () => {
    const failure = new CaptureFailure('unavailable')
    const graph = fakeGraph()
    graph.addModule.mockRejectedValue(failure)
    await expect(startCapture(graph.deps)).rejects.toBe(failure)
  })

  it('accepts a non-default sample rate, for a device that cannot do 16 kHz', async () => {
    const graph = fakeGraph()
    await startCapture(graph.deps, 48_000)
    expect(graph.createdContexts).toEqual([48_000])
  })
})
