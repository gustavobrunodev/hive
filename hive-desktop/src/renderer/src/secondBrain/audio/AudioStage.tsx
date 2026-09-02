import { useCallback, useRef, useState } from 'react'
import { t } from '../../i18n'
import { CloseIcon, PlusIcon, WaveformIcon } from '../../ui/icons'
import { formatBytes } from './audioJobCopy'
import { AUDIO_ACCEPT, isAudioFile, stagedKey } from './audioFiles'

interface AudioStageProps {
  /** Hands the staged files to the transcription queue — the "processar" step. */
  onTranscribe: (files: File[]) => void
  /** True while the engine is downloading/loading/transcribing. */
  busy: boolean
}

/**
 * "Enviar áudio" — choose, review, **then** transcribe (SB-R4.7).
 *
 * The staging step is the whole point of this component. Transcription used to
 * start the instant a file was dropped, which quietly took two decisions away
 * from the user: which files actually go in (a folder drag brings the wrong one
 * along often enough), and which model runs (a 900 MB `small` pass is not
 * something to discover you have started). A batch also costs minutes on a
 * CPU-only machine, and a minutes-long job that begins without being asked for
 * is the definition of a surprise.
 *
 * So files land in a list they can be removed from, the total size is stated,
 * the model strip sits right beside it, and one primary button starts the pass.
 * Everything after that — the per-file queue, the progress, the failures — is
 * `useAudioIngest` and `AudioJobList`, unchanged.
 */
export function AudioStage({ onTranscribe, busy }: AudioStageProps): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)
  const [staged, setStaged] = useState<File[]>([])
  const [over, setOver] = useState(false)
  const [rejected, setRejected] = useState(0)
  // Dragging over a child fires `dragleave` on the parent; counting enter/leave
  // pairs is what keeps the highlight from flickering across the inner nodes.
  const depth = useRef(0)

  const accept = useCallback((list: FileList | null) => {
    const all = [...(list ?? [])]
    const audio = all.filter(isAudioFile)
    setRejected(all.length - audio.length)
    if (audio.length === 0) return
    setStaged((current) => {
      // The same file dropped twice is a slip, not a request to transcribe it
      // twice — and a duplicated pass costs minutes.
      const seen = new Set(current.map(stagedKey))
      return [...current, ...audio.filter((file) => !seen.has(stagedKey(file)))]
    })
  }, [])

  const total = staged.reduce((sum, file) => sum + file.size, 0)
  const empty = staged.length === 0

  return (
    <div className="wb-stage">
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

      {empty ? (
        /* The zone is a button: click and Enter/Space both open the picker, so
           the drop affordance is never the only way in. */
        <button
          type="button"
          className="wb-brain-dropzone"
          data-over={over || undefined}
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
          <WaveformIcon size={24} aria-hidden="true" />
          <span className="wb-brain-dropzone-title">{t('secondBrain.ingestDropTitle')}</span>
          <span className="wb-brain-dropzone-action">{t('secondBrain.ingestPickAudio')}</span>
          <span className="wb-brain-dropzone-hint">{t('secondBrain.ingestAudioHint')}</span>
        </button>
      ) : (
        <div className="wb-stage-list">
          <div className="wb-stage-head">
            <p className="wb-stage-count">
              {t('secondBrain.stageTitle', staged.length)}
              <span className="wb-stage-size">
                {t('secondBrain.stageTotalSize', formatBytes(total))}
              </span>
            </p>
            <button
              type="button"
              className="wb-stage-clear"
              disabled={busy}
              onClick={() => setStaged([])}
            >
              {t('secondBrain.stageClear')}
            </button>
          </div>

          <ul className="wb-stage-files">
            {staged.map((file) => (
              <li key={stagedKey(file)} className="wb-stage-file">
                <WaveformIcon size={14} aria-hidden="true" />
                <span className="wb-stage-file-name" title={file.name}>
                  {file.name}
                </span>
                <span className="wb-stage-file-size">{formatBytes(file.size)}</span>
                <button
                  type="button"
                  className="wb-stage-file-remove"
                  aria-label={t('secondBrain.stageRemove', file.name)}
                  disabled={busy}
                  onClick={() => setStaged((current) => current.filter((entry) => entry !== file))}
                >
                  <CloseIcon size={13} />
                </button>
              </li>
            ))}
          </ul>

          <div className="wb-stage-actions">
            <button
              type="button"
              className="wb-stage-add"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              <PlusIcon size={13} />
              {t('secondBrain.stageAdd')}
            </button>
            <button
              type="button"
              className="wb-stage-go"
              disabled={busy}
              onClick={() => {
                onTranscribe(staged)
                setStaged([])
              }}
            >
              {busy
                ? t('secondBrain.stageTranscribing')
                : t('secondBrain.stageTranscribe', staged.length)}
            </button>
          </div>
          <p className="wb-stage-note">{t('secondBrain.stageHint')}</p>
        </div>
      )}

      {rejected > 0 && (
        <p className="wb-brain-audio-rejected" role="status">
          {t('secondBrain.ingestDropRejected', rejected)}
        </p>
      )}
    </div>
  )
}
