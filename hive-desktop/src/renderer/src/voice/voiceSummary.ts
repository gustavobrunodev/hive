import { t } from '../i18n'
import type { AsrReadiness } from './useAsrReadiness'

/**
 * The one-line summary the profile index shows on the "Voz e transcrição" row.
 *
 * Three answers, not two. `null` means main has not replied yet and the row
 * renders a skeleton for it; a resolved readiness with **no model** is its own
 * statement — the app ships no weights, so "nenhum modelo" is a real and common
 * state, and the index is where a user is most likely to notice it before
 * reaching for the microphone.
 *
 * Its own module rather than a component's, because a `.tsx` exporting a
 * non-component trips `react-refresh/only-export-components`.
 */
export function voiceSummary(readiness: AsrReadiness | null): string | null {
  if (readiness === null) return null
  return readiness.installed ? t('profile.voiceReadySummary') : t('profile.voiceNoneSummary')
}
