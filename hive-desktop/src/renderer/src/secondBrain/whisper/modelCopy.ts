import { t } from '../../i18n'
import type { WhisperModelId } from './useWhisper'

/** The bridge's shapes (the renderer never imports `src/main/*`). */
export type Recommendation = Awaited<ReturnType<Window['hive']['whisper']['recommend']>>
export type ModelInfo = Awaited<ReturnType<Window['hive']['whisper']['listModels']>>[number]

/**
 * Turns the probe's typed `reason` into the sentence shown under the picker.
 * Its own module (not a component's) because a `.tsx` exporting a
 * non-component trips `react-refresh/only-export-components`.
 */
export function recommendationCopy(recommendation: Recommendation | null): string | null {
  if (!recommendation) return null
  switch (recommendation.reason) {
    case 'lowMemory':
      return t('secondBrain.modelsReasonLowMemory', recommendation.ramGB)
    case 'cpuOnly':
      return t('secondBrain.modelsReasonCpuOnly', recommendation.cores)
    case 'noGpu':
      return t('secondBrain.modelsReasonNoGpu')
    case 'discreteGpu':
      return t('secondBrain.modelsReasonDiscreteGpu', recommendation.ramGB)
    case 'balanced':
      return t('secondBrain.modelsReasonBalanced')
    default:
      return t('secondBrain.modelsReasonUnknown')
  }
}

/**
 * The one-word trade-off each bundled model represents.
 *
 * Parameter counts and "~7x" speed multipliers are the *evidence*, not the
 * answer: nobody picking a transcription model is asking how many weights it
 * has, they are asking whether they want it fast or accurate. The numbers stay
 * on the row as the supporting detail; this is the part that is actually a
 * choice.
 */
export function modelTradeoff(id: WhisperModelId): string {
  if (id === 'tiny') return t('secondBrain.modelTradeoffTiny')
  if (id === 'small') return t('secondBrain.modelTradeoffSmall')
  return t('secondBrain.modelTradeoffBase')
}

/** The short "why this one is on screen" line under the picker's trigger. */
export function preferenceCaption(
  auto: boolean,
  bundled: boolean,
  recommendation: Recommendation
): string {
  if (!auto) return bundled ? t('secondBrain.modelPinnedBundled') : t('secondBrain.modelPinned')
  return t('secondBrain.modelAutoChosen', recommendation.ramGB)
}
