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
 * The one-line summary the profile index shows on the "Voz e transcrição" row.
 *
 * Three answers, not two. `null` means main has not replied yet and the row
 * renders a skeleton for it; a resolved preference with **no model** is its own
 * statement — since the app stopped shipping weights, "nenhum modelo" is a real
 * and common state, and the index is where a user is most likely to notice it
 * before reaching for the microphone.
 */
export function preferenceSummary(
  preference: { id: WhisperModelId | null; auto: boolean } | null
): string | null {
  if (preference === null) return null
  if (preference.id === null) return t('profile.voiceNoneSummary')
  return preference.auto ? t('profile.autoSummary', preference.id) : preference.id
}
