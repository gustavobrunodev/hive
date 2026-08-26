import { t } from '../../i18n'
import { isMemoryFailure } from '../../voice/modelFit'
import type { WhisperPhase } from './useWhisper'

/**
 * What the engine's current phase looks like on screen.
 *
 * Replaces the old one-line caption. A caption could only ever say *what* was
 * happening; the failure it presided over was people not knowing whether to
 * keep waiting. So each phase now also carries whether it is measurable and
 * what to expect — the difference between "Preparando o modelo… 100%" followed
 * by silence, and a bar that keeps moving with a line telling you the first
 * run is the slow one.
 *
 * Lives in its own module (not beside the component that renders it) because a
 * `.tsx` file exporting a non-component trips
 * `react-refresh/only-export-components` — the `gitStatus.ts` precedent.
 */
export interface EnginePhaseView {
  /** Machine-readable phase, for styling and tests. */
  kind: 'downloading' | 'loading' | 'warming' | 'transcribing'
  /** What is happening, in the user's language. */
  label: string
  /** 0–100 when the work is measurable, `null` when it genuinely is not. */
  pct: number | null
  /** One line setting expectations. Only where the wait warrants it. */
  hint?: string
}

/** The current phase as the UI should show it, or `null` when idle/failed. */
export function enginePhaseView(phase: WhisperPhase): EnginePhaseView | null {
  switch (phase.status) {
    case 'downloading':
      return {
        kind: 'downloading',
        label: t('secondBrain.phaseDownloading'),
        pct: phase.pct,
        hint: t('secondBrain.phaseDownloadingHint')
      }
    case 'loading':
      return {
        kind: 'loading',
        label: t('secondBrain.phaseLoading'),
        pct: phase.pct
      }
    case 'warming':
      // Genuinely unmeasurable: building the ONNX session emits no progress at
      // all. An indeterminate bar is the honest control here — a fake
      // percentage climbing to 100 and stopping is what broke trust before.
      return {
        kind: 'warming',
        label: t('secondBrain.phaseWarming'),
        pct: null,
        hint: t('secondBrain.phaseWarmingHint')
      }
    case 'transcribing':
      return {
        kind: 'transcribing',
        label: t('secondBrain.phaseTranscribing'),
        pct: null,
        hint: t('secondBrain.phaseTranscribingHint')
      }
    default:
      return null
  }
}

/**
 * The engine's failure, in the user's language.
 *
 * The engine speaks V8 and onnxruntime, and every surface used to print that
 * verbatim: a real take ended with **"Array buffer allocation failed"** on
 * screen — a sentence that names the mechanism, hides the cause (the chosen
 * model does not fit in this renderer's memory) and offers no next step. Only
 * two causes are worth telling apart here, because only two have a different
 * next step: pick a smaller model, or fetch the one you deleted.
 */
export function engineErrorCopy(message: string): string {
  if (isMemoryFailure(message)) return t('whisperError.memory')
  if (/no such file|404|not found|failed to fetch/i.test(message)) return t('whisperError.missing')
  return message.trim() === '' ? t('whisperError.generic') : message
}
