import { t } from '../i18n'
import type { WhisperModelId } from '../secondBrain/whisper/useWhisper'

/** The bridge's shapes (the renderer never imports `src/main/*`). */
export type Recommendation = Awaited<ReturnType<Window['hive']['whisper']['recommend']>>
export type ModelInfo = Awaited<ReturnType<Window['hive']['whisper']['listModels']>>[number]

/**
 * Turns the probe's typed `reason` into the sentence that explains the
 * automatic pick.
 *
 * Its own module rather than a component's, because a `.tsx` exporting a
 * non-component trips `react-refresh/only-export-components`.
 */
export function reasonCopy(recommendation: Recommendation | null): string | null {
  if (!recommendation) return null
  switch (recommendation.reason) {
    case 'lowMemory':
      return t('voice.reasonLowMemory', recommendation.ramGB)
    case 'cpuOnly':
      return t('voice.reasonCpuOnly', recommendation.cores)
    case 'noGpu':
      return t('voice.reasonNoGpu')
    case 'discreteGpu':
      return t('voice.reasonDiscreteGpu', recommendation.ramGB)
    default:
      return t('voice.reasonUnknown')
  }
}

/**
 * The one-word trade-off each bundled model represents.
 *
 * Parameter counts and "~7x" speed multipliers are the *evidence*, not the
 * answer: nobody picking a transcription model is asking how many weights it
 * has, they are asking whether they want it fast or accurate. The numbers stay
 * on the row as supporting detail; this is the part that is actually a choice.
 */
export function modelTradeoff(id: WhisperModelId): string {
  if (id === 'tiny' || id === 'tiny.en') return t('voice.tradeoffTiny')
  if (id === 'base' || id === 'base.en') return t('voice.tradeoffBase')
  return t('voice.tradeoffSmall')
}

/**
 * The one-line summary the profile index shows on the "Voz e transcrição" row.
 *
 * `null` while main is still resolving the preference — the row renders a
 * skeleton for that rather than a model id that is about to change under the
 * reader.
 */
export function preferenceSummary(
  preference: { id: WhisperModelId; auto: boolean } | null
): string | null {
  if (preference === null) return null
  return preference.auto ? t('profile.autoSummary', preference.id) : preference.id
}

/** The caption under the chooser — why *this* model is the one running. */
export function preferenceCaption(preference: { id: WhisperModelId; auto: boolean }): string {
  return preference.auto
    ? t('voice.captionAuto', preference.id)
    : t('voice.captionPinned', preference.id)
}
