import { t } from '../../i18n'

/** The recommendation as the bridge returns it (renderer never imports `src/main/*`). */
export type Recommendation = Awaited<ReturnType<Window['hive']['whisper']['recommend']>>

/**
 * Turns the probe's typed `reason` into the sentence shown under the table.
 * Its own module (not the component's) because a `.tsx` exporting a
 * non-component trips `react-refresh/only-export-components`.
 */
export function recommendationCopy(recommendation: Recommendation | null): string | null {
  if (!recommendation) return null
  switch (recommendation.reason) {
    case 'lowMemory':
      return t('secondBrain.modelsReasonLowMemory', recommendation.ramGB)
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
