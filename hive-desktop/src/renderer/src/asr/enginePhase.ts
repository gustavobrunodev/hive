import { t } from '../i18n'
import type { AsrPhase } from './asrClient'

/**
 * What the engine's current phase looks like on screen.
 *
 * Each phase carries whether it is measurable and what to expect — the
 * difference between "Preparando o modelo… 100%" followed by silence, and a
 * control that tells you the first run is the slow one.
 *
 * **Two of the four phases this used to describe are gone**, and both for
 * structural reasons rather than tidying. `downloading` left because the engine
 * no longer downloads anything: the gate does that before a take can start, so
 * a phase that mixed "fetching 900 MB" with "decoding your sentence" no longer
 * has to exist. `warming` left because it and `loading` were the same event
 * split across two libraries — Transformers.js fetched weights (measurable),
 * then built a session (not) — and sherpa does both in one blocking call.
 *
 * Lives in its own module (not beside the component that renders it) because a
 * `.tsx` file exporting a non-component trips
 * `react-refresh/only-export-components` — the `gitStatus.ts` precedent.
 */
export interface EnginePhaseView {
  /** Machine-readable phase, for styling and tests. */
  kind: 'loading' | 'transcribing'
  /** What is happening, in the user's language. */
  label: string
  /** 0–100 when the work is measurable, `null` when it genuinely is not. */
  pct: number | null
  /** One line setting expectations. Only where the wait warrants it. */
  hint?: string
}

/** The current phase as the UI should show it, or `null` when idle/ready/failed. */
export function enginePhaseView(phase: AsrPhase): EnginePhaseView | null {
  switch (phase.status) {
    case 'loading':
      // Genuinely unmeasurable: building the ONNX session emits no progress at
      // all. An indeterminate control is the honest one here — a fake
      // percentage climbing to 100 and stopping is what broke trust before.
      // Measured at ~1.8 s on eight cores, which is why it is worth naming.
      return {
        kind: 'loading',
        label: t('secondBrain.phaseLoading'),
        pct: null,
        hint: t('secondBrain.phaseLoadingHint')
      }
    case 'transcribing':
      return {
        kind: 'transcribing',
        label: t('secondBrain.phaseTranscribing'),
        pct: null
      }
    default:
      return null
  }
}

/**
 * The engine's failure, in the user's language.
 *
 * The engine speaks ONNX Runtime, and every surface used to print that
 * verbatim: a real take once ended with **"Array buffer allocation failed"** on
 * screen — a sentence that names the mechanism, hides the cause and offers no
 * next step.
 *
 * That particular sentence cannot happen any more; the allocation it named was
 * the renderer's WASM heap. What is left are two causes, kept apart because
 * only two have a different next step: fetch the model you deleted, or try
 * again.
 */
export function engineErrorCopy(message: string): string {
  if (/no model installed|model files missing|no such file|not found/i.test(message)) {
    return t('asrError.missing')
  }
  return message.trim() === '' ? t('asrError.generic') : message
}
