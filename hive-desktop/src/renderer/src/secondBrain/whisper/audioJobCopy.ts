import { t } from '../../i18n'
import type { AudioJob } from './useAudioIngest'

/**
 * The one-line status under each queued file.
 *
 * Separate module because a `.tsx` exporting a non-component trips
 * `react-refresh/only-export-components` — the `gitStatus.ts` precedent.
 */
export function jobStatusText(job: AudioJob): string {
  switch (job.status) {
    case 'queued':
      return t('secondBrain.jobQueued')
    case 'decoding':
      return t('secondBrain.jobDecoding')
    case 'transcribing':
      return t('secondBrain.jobTranscribing')
    case 'done':
      return t('secondBrain.jobDone', job.chars ?? 0)
    case 'error':
      return job.failure?.message ?? t('secondBrain.ingestTranscribeFailed')
  }
}

/** `1,4 MB` — a size the user can sanity-check against their file manager. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${Math.round(kb)} kB`
  return `${(kb / 1024).toFixed(1).replace('.', ',')} MB`
}
