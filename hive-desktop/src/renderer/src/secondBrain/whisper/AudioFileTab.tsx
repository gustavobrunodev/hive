import { useRef } from 'react'
import { t } from '../../i18n'
import { WaveformIcon } from '../../ui/icons'

interface AudioFileTabProps {
  /** Hands the chosen file to the shared audio→transcript path. */
  onFile: (file: Blob) => void
  /** True while the engine is downloading/loading/transcribing. */
  busy: boolean
}

/**
 * "Áudio (arquivo)" — the file picker half of audio ingestion (SB-R4.1). The
 * decode → transcribe → editable-transcript work lives in `useAudioIngest`,
 * shared with the recorder, so an upload and a recording behave identically.
 */
export function AudioFileTab({ onFile, busy }: AudioFileTabProps): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="wb-brain-audio">
      <input
        ref={inputRef}
        type="file"
        accept="audio/*,.wav,.mp3,.m4a,.ogg,.webm,.flac"
        className="wb-visually-hidden"
        aria-label={t('secondBrain.ingestPickAudio')}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onFile(file)
        }}
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
    </div>
  )
}
