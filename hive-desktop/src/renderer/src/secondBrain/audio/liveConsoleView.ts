import { dictationView, type DictationView } from '../../dictation/dictationCopy'
import { isCapturing, type DictationPhase } from '../../dictation/phase'
import { t } from '../../i18n'

/**
 * Everything the live console needs to render, decided in one pure place.
 *
 * The project's own pattern (`enginePhase.ts`, `audioJobCopy.ts`,
 * `dictationCopy.ts`): the branching lives in a tested module rather than
 * inside JSX, where the lint complexity ceiling is the sensor that keeps
 * catching it. It also makes the two rules worth asserting testable without a
 * microphone — that a failed *microphone* retries the device while a failed
 * *segment* retries the audio, and that the meter is fed nothing at all when
 * the phase says the signal is not meaningful.
 */
export interface LiveConsoleView {
  /** `dictationView`'s answer, or `null` when idle. */
  view: DictationView | null
  /** Machine-readable state for the frame's own styling. */
  state: string
  /** Is the microphone open right now? */
  live: boolean
  /** Elapsed seconds, or `null` for the phases with no clock. */
  seconds: number | null
  /** True when the failure is the device rather than a segment. */
  micFailed: boolean
  /** What the retry button says, given which failure it is answering. */
  retryLabel: string
  /** The label under the round control. */
  buttonLabel: string
}

/** Elapsed seconds for the phases that have a clock. */
function elapsedOf(phase: DictationPhase): number | null {
  return phase.status === 'listening' || phase.status === 'preparing' ? phase.seconds : null
}

export function liveConsoleView(phase: DictationPhase): LiveConsoleView {
  const view = dictationView(phase)
  const micFailed = view?.kind === 'denied' || view?.kind === 'unavailable'
  const live = isCapturing(phase)
  return {
    view,
    state: view?.kind ?? 'idle',
    live,
    seconds: elapsedOf(phase),
    micFailed,
    retryLabel: micFailed ? t('secondBrain.liveMicRequest') : t('dictation.retry'),
    buttonLabel: live ? t('secondBrain.liveStop') : t('secondBrain.liveStart')
  }
}

/**
 * The **loudness of the last instant**, 0–1, for the ring around the button.
 *
 * Not a second meter: the meter beside it already shows the shape of the last
 * half-second. This is the single "right now" value, and it is what makes the
 * control feel connected to the room rather than merely toggled.
 */
export function currentLevel(levels: number[]): number {
  return Math.min(1, Math.max(0, levels[levels.length - 1] ?? 0))
}

/**
 * What the meter is fed. Empty whenever the phase says the signal is not
 * meaningful — a meter that keeps moving through a silence notice would be
 * contradicting the sentence right beside it.
 */
export function meterLevels(view: DictationView | null, levels: number[]): number[] {
  return view?.meter === true ? levels : []
}
