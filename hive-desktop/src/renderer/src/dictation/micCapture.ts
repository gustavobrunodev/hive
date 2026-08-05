import type { CaptureError } from './phase'
import type { Tick } from './segmenter'

/**
 * Microphone → 16 kHz mono `Float32` ticks + live meter levels.
 *
 * The graph the T1 spike settled (STATE.md), and nothing more:
 *
 *   getUserMedia(mono, EC/NS/AGC) → AudioContext({ sampleRate: 16000 })
 *                                 → source ─┬─ AnalyserNode (fftSize 256) → meter
 *                                           └─ AudioWorkletNode → ticks
 *
 * Two things the spike removed rather than added: **no `OfflineAudioContext`
 * resample** (asking the context for 16 kHz genuinely delivers a 16 kHz graph
 * even though the track negotiates 48 kHz) and **no `ScriptProcessorNode`
 * fallback** (the worklet loads under this app's CSP). `MediaRecorder` was
 * never a candidate: a mid-stream WebM chunk carries no container header and is
 * not independently decodable, which is exactly what streaming needs.
 *
 * Everything the outside world provides is injected, so the module's real
 * substance — that a stopped capture leaves **nothing** running — is asserted in
 * a unit test with no media stack at all.
 */

/** The pieces of the browser this module touches. */
export interface CaptureDeps {
  getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream>
  createContext(sampleRate: number): AudioContext
  /** Absolute URL of the worklet asset (same-origin — see the file's header). */
  workletUrl(): string
  /**
   * Constructs the worklet node. Injected rather than reached for as a global
   * so the whole graph — and with it the teardown guarantee below — is
   * assertable without a WebAudio implementation.
   */
  createWorkletNode(context: AudioContext, name: string): AudioWorkletNode
}

export interface Capture {
  /** Fixed-cadence PCM + level, one tick per ~32 ms. */
  onTick(listener: (tick: Tick) => void): void
  /** Normalized 0–1 levels for the meter, newest last. */
  onLevels(listener: (levels: number[]) => void): void
  /** Releases everything. Safe to call repeatedly (VP-R4.6). */
  stop(): void
}

/** Capture failed in a way the user can act on. Carries which one. */
export class CaptureFailure extends Error {
  constructor(readonly kind: CaptureError) {
    super(`microphone ${kind}`)
    this.name = 'CaptureFailure'
  }
}

/** Sample rate every tick's PCM arrives at — what Whisper wants, unresampled. */
export const CAPTURE_SAMPLE_RATE = 16_000
/** Must match `registerProcessor` in `public/dictation-tick.worklet.js`. */
const WORKLET_NAME = 'dictation-tick'
/** How many bars of history the meter keeps. */
const LEVEL_HISTORY = 24
/** How often the analyser is sampled for the meter (ms). */
const LEVEL_INTERVAL_MS = 50

/**
 * `getUserMedia`'s DOMException names, mapped to the two cases worth telling
 * apart (VP-R4.3). Same rule `AudioRecorder` already uses — a missing device
 * and a refused permission need different copy and a different next step.
 */
export function captureErrorKind(error: unknown): CaptureError {
  const name = (error as { name?: string } | null)?.name
  return name === 'NotFoundError' || name === 'DevicesNotFoundError' ? 'unavailable' : 'denied'
}

/** The real browser-backed dependencies. */
export function browserCaptureDeps(): CaptureDeps {
  return {
    getUserMedia: (constraints) => navigator.mediaDevices.getUserMedia(constraints),
    createContext: (sampleRate) => new AudioContext({ sampleRate }),
    workletUrl: () => new URL('dictation-tick.worklet.js', document.baseURI).href,
    createWorkletNode: (context, name) => new AudioWorkletNode(context, name)
  }
}

/** RMS of a time-domain frame, normalized into the meter's 0–1 range. */
function levelOf(frame: Float32Array): number {
  let sumSquares = 0
  for (let i = 0; i < frame.length; i += 1) sumSquares += frame[i] * frame[i]
  // ×4 so ordinary speech fills most of the meter instead of hugging the floor:
  // conversational RMS sits around 0.1–0.25, which would otherwise render as a
  // permanently flat bar and read as "not working".
  return Math.min(1, Math.sqrt(sumSquares / frame.length) * 4)
}

/**
 * Opens the microphone and starts producing ticks.
 *
 * Rejects with a `CaptureFailure` carrying `denied` or `unavailable`, having
 * already released whatever it had opened — a failed start must not leave a
 * track live or a context running.
 */
export async function startCapture(
  deps: CaptureDeps = browserCaptureDeps(),
  sampleRate: number = CAPTURE_SAMPLE_RATE
): Promise<Capture> {
  let stream: MediaStream | undefined
  let context: AudioContext | undefined
  let levelTimer: ReturnType<typeof setInterval> | undefined

  /**
   * The two teardown facts `AudioRecorder` learned the hard way: a surviving
   * track keeps the OS microphone indicator lit, and a surviving `AudioContext`
   * keeps the audio thread alive. Both, on every exit path.
   */
  const stop = (): void => {
    if (levelTimer !== undefined) {
      clearInterval(levelTimer)
      levelTimer = undefined
    }
    stream?.getTracks().forEach((track) => track.stop())
    stream = undefined
    void context?.close()
    context = undefined
  }

  try {
    stream = await deps.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    })

    context = deps.createContext(sampleRate)
    const source = context.createMediaStreamSource(stream)

    const analyser = context.createAnalyser()
    analyser.fftSize = 256
    source.connect(analyser)

    await context.audioWorklet.addModule(deps.workletUrl())
    const node = deps.createWorkletNode(context, WORKLET_NAME)
    source.connect(node)
    // A worklet with no downstream sink is not guaranteed to be pulled, so it
    // routes to the destination through a silent gain — the take is never
    // played back to the room, and echo cancellation has nothing to chase.
    const mute = context.createGain()
    mute.gain.value = 0
    node.connect(mute).connect(context.destination)

    const tickListeners: ((tick: Tick) => void)[] = []
    const levelListeners: ((levels: number[]) => void)[] = []

    node.port.onmessage = (event: MessageEvent<Tick>) => {
      for (const listener of tickListeners) listener(event.data)
    }

    const levels: number[] = []
    const frame = new Float32Array(analyser.fftSize)
    levelTimer = setInterval(() => {
      analyser.getFloatTimeDomainData(frame)
      levels.push(levelOf(frame))
      if (levels.length > LEVEL_HISTORY) levels.shift()
      for (const listener of levelListeners) listener([...levels])
    }, LEVEL_INTERVAL_MS)

    return {
      onTick: (listener) => tickListeners.push(listener),
      onLevels: (listener) => levelListeners.push(listener),
      stop
    }
  } catch (error) {
    stop()
    throw error instanceof CaptureFailure ? error : new CaptureFailure(captureErrorKind(error))
  }
}
