import { useCallback, useEffect, useRef, useState } from 'react'
import { t } from '../../i18n'
import { MicIcon, StopIcon } from '../../ui/icons'
import { formatElapsed } from './recorderFormat'
import { Waveform } from './Waveform'

/** Why the microphone is unavailable, so the message can be specific (SB-R5.3). */
type MicError = 'denied' | 'unavailable'

type RecorderState =
  | { status: 'idle' }
  | { status: 'recording'; seconds: number }
  | { status: 'error'; kind: MicError }

interface AudioRecorderProps {
  /** Receives the finished take; the caller decodes + transcribes it. */
  onRecorded: (blob: Blob) => void
  /** True while the engine is busy — recording is blocked until it finishes. */
  busy: boolean
}

/** getUserMedia's DOMException names map to the two cases worth distinguishing. */
function micErrorKind(error: unknown): MicError {
  const name = (error as { name?: string })?.name
  return name === 'NotFoundError' || name === 'DevicesNotFoundError' ? 'unavailable' : 'denied'
}

/**
 * In-app microphone recorder (SB-R5). Records with `MediaRecorder`, shows a
 * live waveform and elapsed timer, and hands the finished Blob to the caller,
 * which runs it through the very same decode → transcribe → editable-transcript
 * path as an uploaded file.
 *
 * The waveform is not decoration: a timer counts up identically whether the
 * microphone is capturing a voice or muted, so the meter is the only thing on
 * screen that answers "is this working?" before the take is already lost.
 *
 * Lifecycle discipline is the other substance here (SB-R5.4): every take stops
 * **all** of its media tracks — on stop, on re-record, and on unmount —
 * because a surviving track keeps the OS microphone indicator lit and holds
 * the device open. The timer is cleared on the same paths.
 */
export function AudioRecorder({ onRecorded, busy }: AudioRecorderProps): React.JSX.Element {
  const [state, setState] = useState<RecorderState>({ status: 'idle' })
  // The live stream is state, not just a ref: the meter renders from it.
  const [stream, setStream] = useState<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  /** Releases the mic and the timer. Safe to call repeatedly. */
  const release = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    recorderRef.current = null
    setStream(null)
  }, [])

  // A component torn down mid-take must not leave the microphone open.
  useEffect(() => release, [release])

  const start = useCallback(async () => {
    // Discard any previous take cleanly before opening a new stream.
    release()
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = media

      const recorder = new MediaRecorder(media)
      recorderRef.current = recorder
      const chunks: Blob[] = []

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) chunks.push(event.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
        release()
        setState({ status: 'idle' })
        onRecorded(blob)
      }

      recorder.start()
      setStream(media)
      setState({ status: 'recording', seconds: 0 })
      timerRef.current = setInterval(() => {
        setState((current) =>
          current.status === 'recording'
            ? { status: 'recording', seconds: current.seconds + 1 }
            : current
        )
      }, 1000)
    } catch (error) {
      release()
      setState({ status: 'error', kind: micErrorKind(error) })
    }
  }, [release, onRecorded])

  const stop = useCallback(() => {
    // `onstop` performs the release + hand-off, so the Blob is complete first.
    recorderRef.current?.stop()
  }, [])

  if (state.status === 'error') {
    return (
      <div className="wb-brain-recorder">
        <p className="wb-brain-recorder-error" role="alert">
          {state.kind === 'unavailable'
            ? t('secondBrain.recordUnavailable')
            : t('secondBrain.recordDenied')}
        </p>
        <button type="button" className="wb-brain-audio-pick" onClick={() => void start()}>
          <MicIcon size={18} />
          {t('secondBrain.recordRetry')}
        </button>
      </div>
    )
  }

  const recording = state.status === 'recording'

  return (
    <div className="wb-brain-recorder" data-recording={recording || undefined}>
      <div className="wb-brain-recorder-stage">
        {recording ? (
          <>
            <Waveform stream={stream} silentLabel={t('secondBrain.recordSilent')} />
            <span
              className="wb-brain-recorder-elapsed"
              role="timer"
              aria-label={t('secondBrain.recordElapsed')}
            >
              <span className="wb-brain-recorder-dot" aria-hidden="true" />
              {formatElapsed(state.seconds)}
            </span>
          </>
        ) : (
          <p className="wb-brain-recorder-idle">{t('secondBrain.recordHint')}</p>
        )}
      </div>
      <button
        type="button"
        className="wb-brain-record-btn"
        data-recording={recording || undefined}
        disabled={busy && !recording}
        onClick={() => (recording ? stop() : void start())}
      >
        {recording ? <StopIcon size={16} /> : <MicIcon size={16} />}
        {recording ? t('secondBrain.recordStop') : t('secondBrain.recordStart')}
      </button>
    </div>
  )
}
