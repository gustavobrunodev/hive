import { useCallback, useRef } from 'react'
import { t } from '../../i18n'
import { WaveformIcon } from '../../ui/icons'
import { AudioDecodeError, decodeToWhisperPcm } from './audio'
import type { WhisperPhase } from './useWhisper'
import { phaseCaption } from './phaseCaption'

interface AudioFileTabProps {
  /** Current engine phase — drives the progress caption. */
  phase: WhisperPhase
  /** Transcribes 16 kHz mono PCM; resolves to the transcript. */
  transcribe: (pcm: Float32Array) => Promise<string>
  /** Fills the shared editable transcript field (SB-R4.3). */
  onTranscript: (text: string) => void
  /** Reports a user-facing failure (SB-R4.6). */
  onError: (message: string) => void
  /** Clears any prior error before a new attempt. */
  onStart: () => void
}

/** Maps a typed decode failure to copy that says what actually went wrong. */
function decodeErrorMessage(error: unknown): string {
  if (error instanceof AudioDecodeError) {
    if (error.kind === 'empty') return t('secondBrain.ingestAudioEmpty')
    if (error.kind === 'silent') return t('secondBrain.ingestAudioSilent')
    return t('secondBrain.ingestAudioUnsupported')
  }
  return t('secondBrain.ingestTranscribeFailed')
}

/**
 * "Áudio (arquivo)" — pick a file, transcribe it **locally**, and drop the
 * result into the shared editable transcript field (SB-R4.1/4.3/4.5/4.6). The
 * transcript is never auto-ingested: the user edits it and presses Ingerir, so
 * the same confirm step serves typed, uploaded and recorded knowledge alike.
 */
export function AudioFileTab({
  phase,
  transcribe,
  onTranscript,
  onError,
  onStart
}: AudioFileTabProps): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)
  const busy = phase.status !== 'idle' && phase.status !== 'error'

  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return
      onStart()
      try {
        const pcm = await decodeToWhisperPcm(file)
        const text = await transcribe(pcm)
        onTranscript(text)
      } catch (error) {
        onError(decodeErrorMessage(error))
      }
    },
    [transcribe, onTranscript, onError, onStart]
  )

  const caption = phaseCaption(phase)

  return (
    <div className="wb-brain-audio">
      <input
        ref={inputRef}
        type="file"
        accept="audio/*,.wav,.mp3,.m4a,.ogg,.webm,.flac"
        className="wb-visually-hidden"
        aria-label={t('secondBrain.ingestPickAudio')}
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
      <button
        type="button"
        className="wb-brain-audio-pick"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        <WaveformIcon size={18} />
        {t('secondBrain.ingestPickAudio')}
      </button>
      <p className="wb-brain-audio-hint">{t('secondBrain.ingestAudioHint')}</p>
      {caption && (
        <p className="wb-brain-audio-progress" role="status">
          {caption}
        </p>
      )}
    </div>
  )
}
