import { LevelMeter } from '@hive/design-system'
import { t } from '../i18n'
import { formatElapsed } from '../secondBrain/whisper/recorderFormat'
import { dictationView } from './dictationCopy'
import type { DictationPhase } from './phase'

/**
 * The dictation transport: what replaces the composer's toolbar cluster while a
 * take is live (VP-R1.3, VP-R4.1–4.5, VP-R5.2, VP-R6.4).
 *
 * **Presentational.** Every prop is either the phase or a callback. No hooks
 * beyond render, no engine, no media, no Chat — which is what lets the next
 * field to gain dictation reuse it unchanged (VP-R5.2).
 *
 * The colour discipline is the Restrained strategy held (VP-R6.4): the send
 * control stays the row's only accent-*filled* element, so Descartar and
 * Concluir are ghost buttons. Two filled buttons fighting inside one 32 px row
 * is the "strangeness without purpose" the product register warns about; the
 * state is carried instead by the frame ring, the record dot and the meter.
 */

export interface DictationBarProps {
  phase: DictationPhase
  /** Live 0–1 levels for the meter. */
  levels: number[]
  /** A segment failure that has not been retried yet (VP-R4.4). */
  failure: string | null
  /** Concluir. */
  onFinish: () => void
  /** Descartar / Esc. */
  onDiscard: () => void
  /** Re-runs the failed segments with their retained audio. */
  onRetry: () => void
  /** Asks for the microphone again after a refusal or a missing device. */
  onRequestMic: () => void
}

/** Elapsed seconds for the phases that have a clock. */
function elapsedOf(phase: DictationPhase): number | null {
  return phase.status === 'listening' || phase.status === 'preparing' ? phase.seconds : null
}

export function DictationBar({
  phase,
  levels,
  failure,
  onFinish,
  onDiscard,
  onRetry,
  onRequestMic
}: DictationBarProps): React.JSX.Element | null {
  const view = dictationView(phase)
  if (view === null) return null

  const seconds = elapsedOf(phase)
  const capturing = seconds !== null
  const micFailed = view.kind === 'denied' || view.kind === 'unavailable'

  return (
    <div className="wb-dictation" data-state={view.kind}>
      {capturing && (
        <span className="wb-dictation-clock">
          <span className="wb-dictation-dot" aria-hidden="true" />
          <span
            className="wb-dictation-elapsed"
            role="timer"
            aria-label={t('dictation.elapsed', formatElapsed(seconds))}
          >
            {formatElapsed(seconds)}
          </span>
        </span>
      )}

      {/* The meter is not decoration: a timer counts up identically whether the
          microphone is capturing a voice or muted (VP-R4.1). */}
      {capturing && (
        <LevelMeter
          className="wb-dictation-meter"
          levels={view.meter ? levels : []}
          bars={16}
          label={t('dictation.meterLabel')}
        />
      )}

      {/* Phase changes announce politely, so a take is followed without sight. */}
      <span className="wb-dictation-status" role="status" aria-live="polite">
        <span className="wb-dictation-status-line">{view.status}</span>
        {view.hint !== undefined && <span className="wb-dictation-hint">{view.hint}</span>}
      </span>

      <span className="wb-dictation-actions">
        {/* One retry, whose meaning follows the failure: a refused or missing
            microphone asks for the device again, anything else re-runs the
            segments whose audio is still held (VP-R4.3 vs VP-R4.4). A failure
            mid-take arrives through `failure` rather than the phase, because
            the take is not over — the clock and the meter keep running. */}
        {(view.retry || failure !== null) && (
          <button
            type="button"
            className="wb-dictation-btn"
            onClick={micFailed ? onRequestMic : onRetry}
          >
            {t('dictation.retry')}
          </button>
        )}
        <button type="button" className="wb-dictation-btn" onClick={onDiscard}>
          {t('dictation.discard')}
        </button>
        {capturing && (
          <button
            type="button"
            className="wb-dictation-btn"
            data-emphasis="primary"
            onClick={onFinish}
          >
            {t('dictation.finish')}
          </button>
        )}
      </span>
    </div>
  )
}
