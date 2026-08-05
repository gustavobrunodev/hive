/**
 * The arithmetic behind the recorder's live waveform.
 *
 * Split out from the component so the part that decides *what the user sees*
 * is testable without a canvas: jsdom has no 2D context, so anything left
 * inside the draw loop is effectively unverifiable.
 */

/** How many bars the meter keeps. ~4 s of history at one bar per frame-ish. */
export const WAVE_BARS = 64

/** Below this RMS the microphone is, for practical purposes, hearing nothing. */
const SILENCE_RMS = 0.006

/** Root-mean-square amplitude of a time-domain buffer, in 0…1. */
export function rms(samples: Float32Array): number {
  if (samples.length === 0) return 0
  let sum = 0
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i]
  return Math.sqrt(sum / samples.length)
}

/**
 * Raw RMS → the fraction of the track a bar should fill.
 *
 * Speech sits low in a linear scale, so a linear meter looks flat and reads as
 * "nothing is being captured" even while recording perfectly. The square root
 * is a cheap perceptual curve that lifts conversational level into the middle
 * of the track; the floor keeps a visible sliver so the meter never looks
 * switched off.
 */
export function levelToBar(level: number): number {
  const shaped = Math.sqrt(Math.max(0, Math.min(1, level * 3.2)))
  return Math.max(0.04, Math.min(1, shaped))
}

/** Appends `level` to a fixed-length history, dropping the oldest sample. */
export function pushLevel(
  history: ReadonlyArray<number>,
  level: number,
  size = WAVE_BARS
): number[] {
  const next = [...history, level]
  return next.length > size ? next.slice(next.length - size) : next
}

/**
 * Whether the last stretch of history is silence — the signal behind "we are
 * recording but hearing nothing", which is the actual question a level meter
 * exists to answer. Requires a full window so the first frames of a take don't
 * flash a warning.
 */
export function isSilent(history: ReadonlyArray<number>, window = 24): boolean {
  if (history.length < window) return false
  return history.slice(-window).every((level) => level < SILENCE_RMS)
}
