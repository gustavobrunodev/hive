import { t } from '../i18n'
import type { ModelInfo } from './voiceCopy'
import type { WhisperModelId } from '../secondBrain/whisper/useWhisper'

/** The value the radio group carries for "let the app decide". */
export const AUTO = 'auto'

/** Narrows the group's string value back to a model id, or `null` for automatic. */
export function pickedModel(value: string): WhisperModelId | null {
  return value === AUTO ? null : (value as WhisperModelId)
}

/**
 * A model row's supporting numbers.
 *
 * A bundled model's size is the fp32 copy **already on disk**, never what a
 * download of some other precision would have cost — the figure has to describe
 * the file this machine actually has, or the row is quoting a hypothetical.
 *
 * Its own module rather than the component's: a `.tsx` exporting a
 * non-component trips `react-refresh/only-export-components`.
 */
export function modelRowMeta(model: ModelInfo): string {
  const size = t('voice.paramsSize', model.params, model.sizeMB.fp32)
  const language = model.multilingual ? '' : ` · ${t('voice.englishOnly')}`
  const suffix = model.bundled ? ` · ${t('voice.bundledBadge')}` : ''
  return `${size}${language}${suffix}`
}
