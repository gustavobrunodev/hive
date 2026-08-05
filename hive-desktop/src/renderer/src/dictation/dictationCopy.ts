import { t } from '../i18n'
import { enginePhaseView } from '../secondBrain/whisper/enginePhase'
import { DEFAULT_SEGMENTER_CONFIG } from './segmenter'
import type { DictationPhase } from './phase'

/**
 * Phase → what the transport says, following the `audioJobCopy.ts` /
 * `healthCopy.ts` / `enginePhase.ts` pattern: the branching lives in a pure,
 * tested module instead of inside JSX (VP-R4.5, VP-R6.5).
 *
 * The states this file distinguishes are not decoration — they are the
 * feature's promise that a spoken thought is never lost (VP-R4). "Ouvindo…"
 * and "não estou ouvindo nada" look identical on a timer; "2 trechos na fila"
 * is the honest alternative to guessed words (D-VP-8); and every failure says
 * out loud that the audio is still held, because a failure that loses the take
 * is the unforgivable one.
 */

/** The machine-readable state the transport styles itself from. */
export type DictationViewKind =
  | 'preparing'
  | 'listening'
  | 'silent'
  | 'autostop'
  | 'finalizing'
  | 'denied'
  | 'unavailable'
  | 'error'

export interface DictationView {
  kind: DictationViewKind
  /** The status line. Always present. */
  status: string
  /** One line below it, only where it earns its place. */
  hint?: string
  /** Segments queued or in flight — a count, never a guessed word (D-VP-8). */
  pending: number
  /** Does a retry affordance belong on screen (VP-R4.3–4.4)? */
  retry: boolean
  /** Is the level meter meaningful right now? Flat-lines on `silent`. */
  meter: boolean
}

interface Thresholds {
  silenceNoticeMs: number
  autoStopMs: number
}

const DEFAULT_THRESHOLDS: Thresholds = {
  silenceNoticeMs: DEFAULT_SEGMENTER_CONFIG.silenceNoticeMs,
  autoStopMs: DEFAULT_SEGMENTER_CONFIG.autoStopMs
}

/**
 * How long before the automatic stop the countdown becomes visible (VP-R4.2:
 * never stop without warning). Three seconds is enough to say "keep talking" in
 * and short enough that it is a warning rather than nagging.
 */
export const AUTOSTOP_WARNING_MS = 3000

/** Whole seconds left before dictation finalizes itself. Never below zero. */
export function autoStopCountdown(silentMs: number, autoStopMs: number): number {
  return Math.max(0, Math.ceil((autoStopMs - silentMs) / 1000))
}

/** The pending-queue suffix, or nothing when the queue is empty. */
function queueSuffix(pending: number): string {
  return pending > 0 ? ` · ${t('dictation.queue', pending)}` : ''
}

/**
 * The three failures, each with its own cause and its own copy (VP-R4.3–4.4).
 * Split out of `dictationView` so neither function has to carry the other's
 * branching — the lint complexity ceiling is the sensor that asked for it.
 */
function failureView(phase: Extract<DictationPhase, { status: 'error' }>): DictationView {
  const base = { pending: 0, retry: true, meter: false } as const
  if (phase.kind === 'denied') {
    return {
      ...base,
      kind: 'denied',
      status: t('dictation.denied'),
      hint: t('dictation.deniedHint')
    }
  }
  if (phase.kind === 'unavailable') {
    return {
      ...base,
      kind: 'unavailable',
      status: t('dictation.unavailable'),
      hint: t('dictation.unavailableHint')
    }
  }
  return {
    ...base,
    kind: 'error',
    status: phase.message ?? t('dictation.error'),
    // The promise that makes a retry worth offering: the audio is still here.
    hint: t('dictation.errorKeep')
  }
}

/**
 * What the transport shows for `phase`, or `null` when dictation is idle (the
 * transport is not mounted then — the toolbar is).
 *
 * `thresholds` is injectable so a test can assert the silence and autostop
 * boundaries without waiting out real seconds.
 */
export function dictationView(
  phase: DictationPhase,
  thresholds: Thresholds = DEFAULT_THRESHOLDS
): DictationView | null {
  if (phase.status === 'idle') return null

  if (phase.status === 'error') return failureView(phase)

  if (phase.status === 'finalizing') {
    return {
      kind: 'finalizing',
      status:
        phase.pending > 0 ? t('dictation.transcribing', phase.pending) : t('dictation.finalizing'),
      pending: phase.pending,
      retry: false,
      meter: false
    }
  }

  // Capturing. Silence outranks everything else that could be said here: the
  // user needs to know the microphone is hearing nothing *before* they finish
  // a take, not after.
  if (phase.silentMs >= thresholds.autoStopMs - AUTOSTOP_WARNING_MS) {
    return {
      kind: 'autostop',
      status: t('dictation.autoStop', autoStopCountdown(phase.silentMs, thresholds.autoStopMs)),
      hint: t('dictation.autoStopHint'),
      pending: phase.pending,
      retry: false,
      meter: false
    }
  }
  if (phase.silentMs >= thresholds.silenceNoticeMs) {
    return {
      kind: 'silent',
      status: t('dictation.silent'),
      hint: t('dictation.silentHint'),
      pending: phase.pending,
      retry: false,
      // Flat line, not idle decoration — the meter is the honest signal here.
      meter: false
    }
  }

  if (phase.status === 'preparing') {
    const engine = enginePhaseView(phase.engine)
    return {
      kind: 'preparing',
      // Reuses M12's engine phase reporting rather than inventing a second
      // vocabulary for the same download (VP-R3.2).
      status: `${t('dictation.preparing')}${engine?.pct !== null && engine?.pct !== undefined ? ` ${engine.pct}%` : ''}${queueSuffix(phase.pending)}`,
      // The explicit promise: the user cannot see the buffer, so it is said.
      hint: t('dictation.preparingKeep'),
      pending: phase.pending,
      retry: false,
      meter: true
    }
  }

  return {
    kind: 'listening',
    status: `${t('dictation.listening')}${queueSuffix(phase.pending)}`,
    pending: phase.pending,
    retry: false,
    meter: true
  }
}
