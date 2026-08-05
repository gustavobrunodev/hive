import type { WhisperPhase } from '../secondBrain/whisper/useWhisper'

/**
 * The dictation state machine's vocabulary, in a types-only module.
 *
 * It sits apart from `useDictation.ts` so the pure modules that only *describe*
 * a phase (`dictationCopy.ts`) and the ones that only *produce* one
 * (`micCapture.ts`) can share the vocabulary without importing the hook —
 * which would drag React, the engine and the media stack into a unit test that
 * needs none of them.
 */

/** Why the microphone is unavailable, so the copy can be specific (VP-R4.3). */
export type CaptureError = 'denied' | 'unavailable'

export type DictationPhase =
  | { status: 'idle' }
  /**
   * Capturing, engine ready. `silentMs` is what makes the difference between
   * "listening" and "not hearing anything" honest (VP-R4.1) — a timer counts up
   * identically either way, which is the defect `AudioRecorder` already
   * documented.
   */
  | { status: 'listening'; seconds: number; silentMs: number; pending: number }
  /**
   * Capturing, engine not ready yet — D-VP-5. Not a gate: the audio is being
   * kept, and `engine` carries the real progress that says so (VP-R3.2).
   */
  | {
      status: 'preparing'
      seconds: number
      silentMs: number
      pending: number
      engine: WhisperPhase
    }
  /** Capture stopped, the queue is draining (VP-R1.4). */
  | { status: 'finalizing'; pending: number }
  /** Capture never started, or a segment failed. The draft is untouched. */
  | { status: 'error'; kind: CaptureError | 'engine'; message?: string }

/** Is the microphone open right now? True for every capturing phase. */
export function isCapturing(phase: DictationPhase): boolean {
  return phase.status === 'listening' || phase.status === 'preparing'
}

/** Is dictation doing anything at all? Drives the composer's accent ring. */
export function isActive(phase: DictationPhase): boolean {
  return phase.status !== 'idle'
}
