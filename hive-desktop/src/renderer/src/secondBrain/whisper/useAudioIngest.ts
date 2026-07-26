import { useCallback } from 'react'
import { t } from '../../i18n'
import { AudioDecodeError, decodeToWhisperPcm } from './audio'
import type { WhisperEngine, WhisperModelId } from './useWhisper'

/** Maps a typed decode failure to copy that says what actually went wrong (SB-R4.6). */
export function audioErrorMessage(error: unknown): string {
  if (error instanceof AudioDecodeError) {
    if (error.kind === 'empty') return t('secondBrain.ingestAudioEmpty')
    if (error.kind === 'silent') return t('secondBrain.ingestAudioSilent')
    return t('secondBrain.ingestAudioUnsupported')
  }
  return t('secondBrain.ingestTranscribeFailed')
}

/**
 * The one audio→transcript path, shared by the file tab and the recorder
 * (SB-R4.5/R5.5): decode to 16 kHz mono PCM, transcribe locally, and hand the
 * text to the shared editable field. Both capture modes go through here so a
 * recording and an upload behave identically — including their error copy.
 */
export function useAudioIngest(
  whisper: WhisperEngine,
  model: WhisperModelId,
  onTranscript: (text: string) => void,
  onError: (message: string | null) => void
): (blob: Blob) => Promise<void> {
  return useCallback(
    async (blob: Blob) => {
      onError(null)
      try {
        const pcm = await decodeToWhisperPcm(blob)
        onTranscript(await whisper.transcribe(pcm, { model }))
      } catch (error) {
        onError(audioErrorMessage(error))
      }
    },
    [whisper, model, onTranscript, onError]
  )
}
