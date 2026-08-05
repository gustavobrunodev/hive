import { t } from '../../i18n'
import { CheckIcon, CloseIcon, WaveformIcon } from '../../ui/icons'
import { formatBytes, jobStatusText } from './audioJobCopy'
import type { AudioJob } from './useAudioIngest'

interface AudioJobListProps {
  jobs: ReadonlyArray<AudioJob>
  /** Drops a finished or failed row. */
  onRemove: (id: string) => void
}

/**
 * One row per piece of audio, with what it is doing right now.
 *
 * The queue is sequential — a warm pipeline processes one file at a time — so
 * without a per-file view a batch looks like a single frozen operation. Each
 * row therefore carries its own state and its own failure: one unreadable file
 * out of six should not read as "the transcription is broken", and the five
 * that worked should be visibly done.
 */
export function AudioJobList({ jobs, onRemove }: AudioJobListProps): React.JSX.Element | null {
  if (jobs.length === 0) return null
  return (
    <ul className="wb-brain-jobs">
      {jobs.map((job) => {
        const settled = job.status === 'done' || job.status === 'error'
        return (
          <li key={job.id} className="wb-brain-job" data-status={job.status}>
            <span className="wb-brain-job-mark" aria-hidden="true">
              {job.status === 'done' ? <CheckIcon size={13} /> : <WaveformIcon size={14} />}
            </span>
            <span className="wb-brain-job-main">
              <span className="wb-brain-job-name" title={job.name}>
                {job.name}
              </span>
              <span className="wb-brain-job-status">
                {jobStatusText(job)}
                {job.size > 0 && (
                  <span className="wb-brain-job-size"> · {formatBytes(job.size)}</span>
                )}
              </span>
              {job.failure?.detail !== undefined && (
                <details className="wb-brain-job-detail">
                  <summary>{t('secondBrain.jobDetails')}</summary>
                  <code>{job.failure.detail}</code>
                </details>
              )}
            </span>
            {settled && (
              <button
                type="button"
                className="wb-brain-job-remove"
                aria-label={t('secondBrain.jobRemove', job.name)}
                onClick={() => onRemove(job.id)}
              >
                <CloseIcon size={13} />
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
