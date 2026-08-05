import { useCallback, useRef, useState } from 'react'
import { t } from '../../i18n'
import { WaveformIcon } from '../../ui/icons'

interface AudioFileTabProps {
  /** Hands the chosen files to the shared audio→transcript queue. */
  onFiles: (files: File[]) => void
  /** True while the engine is downloading/loading/transcribing. */
  busy: boolean
}

/** Extensions the WebAudio decoder handles; anything else is rejected up front. */
const AUDIO_ACCEPT = 'audio/*,.wav,.mp3,.m4a,.ogg,.webm,.flac'

/** Whether a dropped item is plausibly audio — by MIME first, extension second. */
function isAudio(file: File): boolean {
  if (file.type.startsWith('audio/')) return true
  return /\.(wav|mp3|m4a|ogg|webm|flac|aac|opus)$/i.test(file.name)
}

/**
 * "Áudio (arquivo)" — the file half of audio ingestion (SB-R4.1).
 *
 * A drop target rather than a lone button: files arrive from a file manager,
 * and making people route a file they are already dragging through a picker
 * dialog is the kind of friction that reads as an unfinished tool. The button
 * stays, because dragging is not everyone's input method and a drop zone with
 * no keyboard path is not accessible.
 *
 * Several files at once are the normal case here (a folder of voice memos), so
 * this hands over a list; the decode → transcribe work and its per-file status
 * live in `useAudioIngest`, shared with the recorder.
 */
export function AudioFileTab({ onFiles, busy }: AudioFileTabProps): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [rejected, setRejected] = useState(0)
  // Dragging over a child fires `dragleave` on the parent; counting enter/leave
  // pairs is what keeps the highlight from flickering across the inner nodes.
  const depth = useRef(0)

  const accept = useCallback(
    (list: FileList | null) => {
      const all = [...(list ?? [])]
      const audio = all.filter(isAudio)
      setRejected(all.length - audio.length)
      if (audio.length > 0) onFiles(audio)
    },
    [onFiles]
  )

  return (
    <div className="wb-brain-audio">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={AUDIO_ACCEPT}
        className="wb-visually-hidden"
        aria-label={t('secondBrain.ingestPickAudio')}
        onChange={(event) => {
          accept(event.target.files)
          // Reset so re-picking the same file fires `change` again.
          event.target.value = ''
        }}
      />
      {/* The zone is a button: click and Enter/Space both open the picker, so
          the drop affordance is never the only way in. */}
      <button
        type="button"
        className="wb-brain-dropzone"
        data-over={over || undefined}
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault()
          depth.current += 1
          setOver(true)
        }}
        onDragOver={(event) => {
          event.preventDefault()
          event.dataTransfer.dropEffect = 'copy'
        }}
        onDragLeave={() => {
          depth.current = Math.max(0, depth.current - 1)
          if (depth.current === 0) setOver(false)
        }}
        onDrop={(event) => {
          event.preventDefault()
          depth.current = 0
          setOver(false)
          accept(event.dataTransfer.files)
        }}
      >
        <WaveformIcon size={22} aria-hidden="true" />
        <span className="wb-brain-dropzone-title">{t('secondBrain.ingestDropTitle')}</span>
        <span className="wb-brain-dropzone-action">{t('secondBrain.ingestPickAudio')}</span>
        <span className="wb-brain-dropzone-hint">{t('secondBrain.ingestAudioHint')}</span>
      </button>
      {rejected > 0 && (
        <p className="wb-brain-audio-rejected" role="status">
          {t('secondBrain.ingestDropRejected', rejected)}
        </p>
      )}
    </div>
  )
}
