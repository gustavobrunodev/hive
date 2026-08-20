import { LevelMeter } from '@hive/design-system'
import { t } from '../../i18n'
import { MicIcon, StopIcon } from '../../ui/icons'
import type { DictationView } from '../../dictation/dictationCopy'
import type { DictationPhase } from '../../dictation/phase'
import { formatElapsed } from './recorderFormat'
import { currentLevel, liveConsoleView, meterLevels } from './liveConsoleView'

export interface LiveConsoleProps {
  phase: DictationPhase
  /** Live 0–1 levels for the meter. */
  levels: number[]
  /** A segment failure that has not been retried yet (VP-R4.4). */
  failure: string | null
  onStart: () => void
  onFinish: () => void
  onDiscard: () => void
  onRetry: () => void
  /** Warms the engine on intent, so the first phrase is not the one that waits. */
  onPrewarm: () => void
  /** True while the sheet is busy elsewhere (a file batch is transcribing). */
  disabled: boolean
}

/**
 * What the console is saying right now.
 *
 * Idle teaches, everything else reports — and the reporting half announces
 * politely, so a take can be followed without watching it.
 */
function Readout({ view }: { view: DictationView | null }): React.JSX.Element {
  return (
    <div className="wb-live-readout">
      {view === null ? (
        <>
          <p className="wb-live-title">{t('secondBrain.liveIdleTitle')}</p>
          <p className="wb-live-hint">{t('secondBrain.liveIdleHint')}</p>
        </>
      ) : (
        <>
          <p className="wb-live-title" role="status" aria-live="polite">
            {view.status}
          </p>
          {view.hint !== undefined && <p className="wb-live-hint">{view.hint}</p>}
        </>
      )}
    </div>
  )
}

/**
 * The meter and the clock. The meter is not decoration: a timer counts up
 * identically whether the microphone is capturing a voice or muted, so this is
 * the only thing here that can answer "is it hearing me?".
 */
function Signal({ seconds, levels }: { seconds: number; levels: number[] }): React.JSX.Element {
  return (
    <div className="wb-live-signal">
      <LevelMeter
        className="wb-live-meter"
        levels={levels}
        bars={18}
        label={t('dictation.meterLabel')}
      />
      <span
        className="wb-live-clock"
        role="timer"
        aria-label={t('dictation.elapsed', formatElapsed(seconds))}
      >
        {formatElapsed(seconds)}
      </span>
    </div>
  )
}

/**
 * Discard, plus a retry whose meaning follows the failure: a refused or missing
 * microphone asks for the device again, anything else re-runs the segments
 * whose audio is still held (VP-R4.3 vs VP-R4.4).
 *
 * There is deliberately **no** "Concluir" here. The round control is the finish
 * control while a take is live, and a second button doing the same thing under
 * the same name is two ways to say one thing.
 */
function Actions({
  view,
  failure,
  onDiscard,
  onRetry,
  retryLabel
}: {
  view: DictationView
  failure: string | null
  onDiscard: () => void
  onRetry: () => void
  retryLabel: string
}): React.JSX.Element {
  return (
    <div className="wb-live-actions">
      {(view.retry || failure !== null) && (
        <button type="button" className="wb-live-action" onClick={onRetry}>
          {retryLabel}
        </button>
      )}
      <button type="button" className="wb-live-action" onClick={onDiscard}>
        {t('dictation.discard')}
      </button>
    </div>
  )
}

/**
 * Live dictation, as a stage rather than a toolbar (SB-R5.6).
 *
 * This replaced a recorder that captured a take, stopped, and only then went
 * looking for words — a model that made the wait the whole experience and gave
 * the user nothing to correct until it was over. Here the microphone, the
 * engine and the transcript run at the same time: phrases are cut on silence
 * and transcribed while the next one is still being spoken, and each result
 * lands in the field below with the run it wrote marked.
 *
 * Three things are deliberate about the picture:
 *
 * - **One primary control.** A big circular button that starts and stops, the
 *   affordance every voice recorder on every platform already taught. Descartar
 *   and Concluir are ghost buttons beside it; two filled buttons in one row is
 *   the "strangeness without purpose" the product register warns about.
 * - **The ring is real data.** It is driven by the current input level, so an
 *   open microphone that is hearing nothing looks different from one that is —
 *   the failure a counting timer cannot show, and the reason the silence copy
 *   exists at all.
 * - **Nothing here is a spinner.** Preparing the model, a queued phrase, a
 *   failed segment: each is a sentence that says what is happening and what is
 *   being kept, because the one thing a user cannot verify for themselves is
 *   whether their words survived.
 */
export function LiveConsole({
  phase,
  levels,
  failure,
  onStart,
  onFinish,
  onDiscard,
  onRetry,
  onPrewarm,
  disabled
}: LiveConsoleProps): React.JSX.Element {
  const { view, state, live, seconds, micFailed, retryLabel, buttonLabel } = liveConsoleView(phase)

  return (
    <div
      className="wb-live"
      data-state={state}
      // Continuous data, so it cannot live in a stylesheet — the ring reads it.
      style={{ '--wb-live-level': currentLevel(levels) } as React.CSSProperties}
    >
      <div className="wb-live-stage">
        <button
          type="button"
          className="wb-live-btn"
          data-live={live || undefined}
          disabled={disabled && !live}
          onPointerEnter={onPrewarm}
          onFocus={onPrewarm}
          onClick={live ? onFinish : onStart}
        >
          <span className="wb-live-btn-ring" aria-hidden="true" />
          {live ? <StopIcon size={20} /> : <MicIcon size={22} />}
          <span className="wb-visually-hidden">{buttonLabel}</span>
        </button>

        <Readout view={view} />

        {seconds !== null && <Signal seconds={seconds} levels={meterLevels(view, levels)} />}
      </div>

      {view !== null && (
        <Actions
          view={view}
          failure={failure}
          onDiscard={onDiscard}
          onRetry={micFailed ? onStart : onRetry}
          retryLabel={retryLabel}
        />
      )}
    </div>
  )
}
