/**
 * Silence → segment boundaries, as a pure state machine (VP-R2.1, 2.6–2.8,
 * VP-R4.1–4.2).
 *
 * This is the heart of D-VP-2: the user keeps talking while each finished
 * phrase is handed to the transcription queue. Deciding *where* a phrase ends
 * is the whole problem, and it is decided here — fed one tick at a time, with
 * no WebAudio, no `MediaStream` and no DOM anywhere near it, so every rule
 * below is asserted from synthetic level arrays instead of from a microphone.
 *
 * Two measurements from the T1 spike shape the defaults (STATE.md):
 *   - a tick is 512 samples at 16 kHz = **32 ms**, the real cadence the audio
 *     worklet delivers;
 *   - one segment costs ~3.5–4 s to transcribe **whatever its length**, because
 *     Whisper pads every window to 30 s. So cutting early buys nothing and
 *     spends a whole pipeline slot — which is why `minSpeechMs` is 2000 and not
 *     the 1200 the design first guessed.
 */

/** One fixed-cadence slice of captured audio, as `micCapture` produces it. */
export interface Tick {
  /** Root-mean-square level of `samples`, 0–1. */
  rms: number
  /** The mono PCM for this slice, at `sampleRate`. */
  samples: Float32Array
}

export interface SegmenterConfig {
  /** Sample rate of every tick's PCM. The T1 spike confirmed 16 kHz is real. */
  sampleRate: number
  /** Speech is anything above the measured noise floor by this margin. */
  rmsMargin: number
  /** Continuous silence that closes a segment. */
  silenceHoldMs: number
  /**
   * Below this much *speech*, a pause does not cut (breath ≠ boundary), and
   * — see the header — a short segment costs a full pipeline slot anyway.
   */
  minSpeechMs: number
  /** Hard ceiling for one segment. */
  maxSegmentMs: number
  /** Audio kept from before onset, so the first phoneme survives. */
  preRollMs: number
  /** Audio kept after the cut, so the last consonant survives. */
  tailPadMs: number
  /** Silence after which the UI says it is not hearing anything. */
  silenceNoticeMs: number
  /** Silence after which dictation finalizes itself. */
  autoStopMs: number
}

/** The measured, reasoned defaults. Every field is overridable for tests. */
export const DEFAULT_SEGMENTER_CONFIG: SegmenterConfig = {
  sampleRate: 16_000,
  rmsMargin: 0.015,
  silenceHoldMs: 700,
  minSpeechMs: 2000,
  maxSegmentMs: 15_000,
  preRollMs: 300,
  tailPadMs: 200,
  silenceNoticeMs: 3000,
  autoStopMs: 8000
}

export type SegmenterEvent =
  /** Speech started — a segment is now open. */
  | { type: 'speech' }
  /** A finished phrase, in spoken order. `index` is what keeps it in order. */
  | { type: 'segment'; index: number; pcm: Float32Array; ms: number }
  /** Nothing has been heard for `silentMs` — say so (VP-R4.1). */
  | { type: 'notice'; silentMs: number }
  /** Silence ran long enough to finalize on the user's behalf (VP-R4.2). */
  | { type: 'autostop' }

export interface Segmenter {
  /** Feeds one tick and returns whatever it caused. */
  push(tick: Tick): SegmenterEvent[]
  /** Closes whatever is open — used by Concluir. */
  flush(): SegmenterEvent[]
  /** Current noise floor, exposed so the meter can be honest about the gate. */
  noiseFloor(): number
}

/**
 * How fast the floor may rise, per tick, toward a louder level (~0.1%).
 * Deliberately glacial: at 32 ms ticks this is a ~30 s time constant, long
 * enough that a 15 s segment of continuous speech cannot drag the gate up
 * behind its own voice, short enough that a fan switching on is absorbed
 * instead of being mistaken for speech forever.
 */
const FLOOR_RISE = 0.001

function concat(chunks: Float32Array[], length: number): Float32Array {
  const out = new Float32Array(length)
  let offset = 0
  for (const chunk of chunks) {
    if (offset + chunk.length > length) {
      out.set(chunk.subarray(0, length - offset), offset)
      return out
    }
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}

/**
 * Creates a segmenter.
 *
 * **Noise floor.** A fixed threshold fails on real hardware — a laptop fan or
 * an open office sits well above zero — so the gate is `floor + rmsMargin`,
 * where `floor` tracks the quietest thing the microphone has recently heard:
 * **instantly downward, glacially upward** (`FLOOR_RISE`), seeded by the very
 * first tick.
 *
 * The asymmetry is the whole trick, and the first cut of this file got it
 * wrong in a way the tests caught: calibrating from ticks *classified as
 * silence* cannot bootstrap at all, because in a room with any real noise the
 * very first tick already reads as speech, so no tick ever teaches the floor
 * anything and the gate stays open forever. Tracking the minimum needs no
 * bootstrap and no blocking calibration window in front of the microphone —
 * capture is live from tick one — while the slow rise stops a fan that starts
 * mid-take from reading as a voice indefinitely. Speech's own inter-word dips
 * bring the floor down to the room's true level within a few hundred ms, which
 * the pre-roll buffer covers.
 */
export function createSegmenter(config: SegmenterConfig = DEFAULT_SEGMENTER_CONFIG): Segmenter {
  const msPerSample = 1000 / config.sampleRate
  const preRollSamples = Math.round(config.preRollMs / msPerSample)
  const tailPadSamples = Math.round(config.tailPadMs / msPerSample)

  /** The measured room level. `null` until the first tick seeds it. */
  let floor: number | null = null
  /** Retained even while classified as silence, so onset is never clipped. */
  let preRoll: Float32Array[] = []
  let preRollLength = 0

  let open = false
  let segment: Float32Array[] = []
  let segmentLength = 0
  /** Samples in `segment` as of the end of the last speech tick — the tail cut. */
  let speechEndLength = 0
  let speechMs = 0
  let segmentMs = 0
  let silenceMs = 0
  let index = 0
  let noticed = false
  let autostopped = false

  const noiseFloor = (): number => floor ?? 0

  /** Instant downward, glacial upward. See the header for why. */
  const trackFloor = (rms: number): void => {
    floor = floor === null || rms < floor ? rms : floor + (rms - floor) * FLOOR_RISE
  }

  const resetSegment = (): void => {
    open = false
    segment = []
    segmentLength = 0
    speechEndLength = 0
    speechMs = 0
    segmentMs = 0
  }

  /** Closes the open segment, trimming trailing silence down to the tail pad. */
  const cut = (): SegmenterEvent => {
    const keep = Math.min(segmentLength, speechEndLength + tailPadSamples)
    const pcm = concat(segment, keep)
    resetSegment()
    preRoll = []
    preRollLength = 0
    return { type: 'segment', index: index++, pcm, ms: pcm.length * msPerSample }
  }

  const push = (tick: Tick): SegmenterEvent[] => {
    const events: SegmenterEvent[] = []
    const tickMs = tick.samples.length * msPerSample
    // The floor learns from every tick, including this one — that is what makes
    // the very first tick self-seeding rather than a guess.
    trackFloor(tick.rms)
    const isSpeech = tick.rms > noiseFloor() + config.rmsMargin

    if (isSpeech) {
      silenceMs = 0
      noticed = false
      autostopped = false

      if (!open) {
        open = true
        segment = preRoll
        segmentLength = preRollLength
        preRoll = []
        preRollLength = 0
        events.push({ type: 'speech' })
      }

      segment.push(tick.samples)
      segmentLength += tick.samples.length
      speechEndLength = segmentLength
      speechMs += tickMs
      segmentMs += tickMs

      // VP-R2.7 — no segment grows without bound.
      if (segmentMs >= config.maxSegmentMs) events.push(cut())
      return events
    }

    silenceMs += tickMs

    if (open) {
      // Kept, not dropped: this is the material the tail pad is cut from.
      segment.push(tick.samples)
      segmentLength += tick.samples.length
      segmentMs += tickMs
      // VP-R2.6 — a breath is not a boundary. Under `minSpeechMs` the pause is
      // absorbed and the segment stays open; the hold alone never cuts.
      if (silenceMs >= config.silenceHoldMs && speechMs >= config.minSpeechMs) {
        events.push(cut())
      }
    } else {
      preRoll.push(tick.samples)
      preRollLength += tick.samples.length
      while (preRoll.length > 0 && preRollLength - preRoll[0].length >= preRollSamples) {
        preRollLength -= preRoll[0].length
        preRoll.shift()
      }
    }

    if (!noticed && silenceMs >= config.silenceNoticeMs) {
      noticed = true
      events.push({ type: 'notice', silentMs: silenceMs })
    }
    if (!autostopped && silenceMs >= config.autoStopMs) {
      autostopped = true
      events.push({ type: 'autostop' })
    }
    return events
  }

  const flush = (): SegmenterEvent[] => {
    // Silence-only leftovers are not a phrase; cutting them would hand the
    // engine a segment guaranteed to transcribe as nothing.
    if (!open || speechMs === 0) {
      resetSegment()
      return []
    }
    return [cut()]
  }

  return { push, flush, noiseFloor }
}
