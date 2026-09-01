import { useCallback, useEffect, useRef, useState } from 'react'
import { t } from '../../i18n'
import { AudioDecodeError, decodeToWhisperPcm } from './audio'
import { WhisperMemoryError } from './whisperClient'
import type { WhisperEngine, WhisperModelId } from './useWhisper'

/** What went wrong, in the user's language, plus the engine's own words. */
export interface AudioFailure {
  /** The sentence shown by default. Always actionable, never a stack trace. */
  message: string
  /**
   * The underlying error text, kept for the "detalhes" disclosure. It is
   * English and technical, which is exactly why it is never the headline — but
   * hiding it entirely is what left "Não foi possível transcrever o áudio."
   * as the only thing anyone could report back.
   */
  detail?: string
}

/** Maps a typed decode failure to copy that says what actually went wrong (SB-R4.6). */
export function audioErrorMessage(error: unknown): AudioFailure {
  if (error instanceof AudioDecodeError) {
    if (error.kind === 'empty') return { message: t('secondBrain.ingestAudioEmpty') }
    if (error.kind === 'silent') return { message: t('secondBrain.ingestAudioSilent') }
    return { message: t('secondBrain.ingestAudioUnsupported') }
  }
  // The one failure where "tente de novo" is bad advice: the WASM heap is gone
  // and the next attempt hits the same ceiling. A smaller model is what changes
  // the outcome, so that is what the sentence says.
  if (error instanceof WhisperMemoryError) {
    return { message: t('secondBrain.ingestMemoryFailed'), detail: error.detail }
  }
  return {
    message: t('secondBrain.ingestTranscribeFailed'),
    detail: error instanceof Error ? error.message : String(error)
  }
}

/** Where one piece of audio is on its way to becoming text. */
export type AudioJobStatus = 'queued' | 'decoding' | 'transcribing' | 'done' | 'error'

/** One audio item, tracked individually so the UI can say what each one is doing. */
export interface AudioJob {
  id: string
  /** File name, or a generated label for a recording. */
  name: string
  /** Bytes, for the size line. */
  size: number
  status: AudioJobStatus
  /** Set when `status` is `error`. */
  failure?: AudioFailure
  /** Transcript length, set when `status` is `done` — proof something came out. */
  chars?: number
  /**
   * Text decoded so far, while `status` is `transcribing`.
   *
   * A recording of any length used to be a single silent wait: the row said
   * "Transcrevendo…" from the first second to the last, and a meeting recording
   * can spend minutes there. The engine has always produced its text
   * incrementally — nothing was listening. Now the row shows the words arriving,
   * which is both the progress bar this never had and proof that the file was
   * readable at all.
   */
  partial?: string
}

export interface AudioIngestQueue {
  jobs: AudioJob[]
  /** Enqueues audio; processing starts on its own and runs one at a time. */
  add: (items: ReadonlyArray<{ blob: Blob; name: string }>) => void
  /** Drops a finished or failed row from the list. */
  remove: (id: string) => void
  /** Clears every row that is no longer working. */
  clearFinished: () => void
  /** True while anything is decoding or transcribing. */
  busy: boolean
}

let sequence = 0
const nextId = (): string => `audio-${++sequence}`

/**
 * The one audio→transcript path, shared by the file tab and the recorder
 * (SB-R4.5/R5.5): decode to 16 kHz mono PCM, transcribe locally, and hand the
 * text to the shared editable field.
 *
 * It is a **queue** rather than a single call because the engine is one warm
 * pipeline: several dropped files have to go through it one at a time, and the
 * only way that reads as anything other than a freeze is to track each file
 * separately and show it. Both capture modes go through here, so a recording
 * and an upload behave identically — including their error copy.
 */
export function useAudioIngest(
  whisper: WhisperEngine,
  /**
   * The model to transcribe with, or `null` while none is installed (M26).
   * The queue never runs in that state — the sheet gates the file picker
   * behind the model gate — so it is carried through rather than defaulted,
   * which would let a stray call pick weights that are not on disk.
   */
  model: WhisperModelId | null,
  onTranscript: (text: string, name: string) => void
): AudioIngestQueue {
  const [jobs, setJobs] = useState<AudioJob[]>([])
  // Blobs live outside React state: they are large, and state is for what the
  // UI renders. The ref mirror of `jobs` is what the pump reads, since it runs
  // across awaits and must not close over a stale render's array.
  const blobs = useRef(new Map<string, Blob>())
  const jobsRef = useRef<AudioJob[]>([])
  const pumping = useRef(false)
  // The pump runs across awaits, so it must call the *current* handler rather
  // than the one captured when the queue started. Latched in an effect, not
  // during render, which would be a write while React is still reading.
  const transcriptRef = useRef(onTranscript)
  useEffect(() => {
    transcriptRef.current = onTranscript
  }, [onTranscript])

  const write = useCallback((next: AudioJob[]): void => {
    jobsRef.current = next
    setJobs(next)
  }, [])

  const patch = useCallback(
    (id: string, changes: Partial<AudioJob>): void => {
      write(jobsRef.current.map((job) => (job.id === id ? { ...job, ...changes } : job)))
    },
    [write]
  )

  const pump = useCallback(async (): Promise<void> => {
    if (pumping.current) return
    pumping.current = true
    try {
      for (;;) {
        const next = jobsRef.current.find((job) => job.status === 'queued')
        if (!next) return
        const blob = blobs.current.get(next.id)
        if (!blob) {
          patch(next.id, {
            status: 'error',
            failure: { message: t('secondBrain.ingestAudioEmpty') }
          })
          continue
        }
        try {
          patch(next.id, { status: 'decoding' })
          const pcm = await decodeToWhisperPcm(blob)
          patch(next.id, { status: 'transcribing', partial: '' })
          const text = await whisper.transcribe(pcm, {
            model: model ?? undefined,
            onPartial: (partial) => patch(next.id, { partial })
          })
          patch(next.id, { status: 'done', chars: text.length, partial: undefined })
          transcriptRef.current(text, next.name)
        } catch (error) {
          patch(next.id, { status: 'error', failure: audioErrorMessage(error) })
        } finally {
          blobs.current.delete(next.id)
        }
      }
    } finally {
      pumping.current = false
    }
  }, [whisper, model, patch])

  const add = useCallback(
    (items: ReadonlyArray<{ blob: Blob; name: string }>): void => {
      if (items.length === 0) return
      const queued = items.map(({ blob, name }) => {
        const id = nextId()
        blobs.current.set(id, blob)
        return { id, name, size: blob.size, status: 'queued' as const }
      })
      write([...jobsRef.current, ...queued])
      void pump()
    },
    [pump, write]
  )

  const remove = useCallback(
    (id: string): void => {
      blobs.current.delete(id)
      write(jobsRef.current.filter((job) => job.id !== id))
    },
    [write]
  )

  const clearFinished = useCallback((): void => {
    write(jobsRef.current.filter((job) => job.status !== 'done' && job.status !== 'error'))
  }, [write])

  // Pending blobs are large; a sheet torn down mid-queue must not hold them.
  useEffect(
    () => () => {
      blobs.current.clear()
    },
    []
  )

  return {
    jobs,
    add,
    remove,
    clearFinished,
    busy: jobs.some((job) => job.status === 'decoding' || job.status === 'transcribing')
  }
}
