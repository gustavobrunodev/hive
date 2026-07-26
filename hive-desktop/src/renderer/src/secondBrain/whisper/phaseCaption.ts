import { t } from '../../i18n'
import type { WhisperPhase } from './useWhisper'

/**
 * The engine's live progress caption, or `null` when there is nothing to say.
 *
 * Lives in its own module (not beside the component that renders it) because a
 * `.tsx` file exporting a non-component trips `react-refresh/only-export-components`
 * — the `gitStatus.ts` precedent.
 */
export function phaseCaption(phase: WhisperPhase): string | null {
  switch (phase.status) {
    case 'downloading':
      return t('secondBrain.ingestModelDownloading', phase.pct)
    case 'loading':
      return t('secondBrain.ingestModelLoading', phase.pct)
    case 'transcribing':
      return t('secondBrain.ingestTranscribing')
    default:
      return null
  }
}
