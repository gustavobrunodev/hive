import { t } from '../i18n'

/** The bridge's own shapes (the renderer never imports `src/main/*`). */
export type AsrDownload = Awaited<ReturnType<Window['hive']['asr']['downloads']>>[number]
export type AsrDownloadFailure = NonNullable<AsrDownload['failure']>

const MB = 1024 * 1024
const GB = 1024 * MB

/**
 * Bytes as a person reads them, in pt-BR (decimal comma).
 *
 * Two decisions the obvious version gets wrong. The unit switches at 1 GB, not
 * at 1000 MB, so `923 MB` never renders as `0,9 GB`; and MB are whole numbers
 * while GB carry one decimal, because "2.847 MB" and "2,8 GB" describe the same
 * download and only one of them is a size a person can hold in their head.
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return t('voice.zeroBytes')
  if (bytes >= GB) return t('voice.gigabytes', (bytes / GB).toFixed(1).replace('.', ','))
  return t('voice.megabytes', Math.max(1, Math.round(bytes / MB)))
}

/** The catalog's own `sizeMB` figure, through the same two rules. */
export function formatMegabytes(mb: number): string {
  return formatBytes(mb * MB)
}

/** Transfer rate, or `null` before enough samples exist to state one. */
export function formatRate(bytesPerSecond: number): string | null {
  if (bytesPerSecond <= 0) return null
  return t('voice.rate', (bytesPerSecond / MB).toFixed(1).replace('.', ','))
}

/**
 * How much longer, in words — `null` when there is no honest answer yet.
 *
 * Deliberately coarse. Second-by-second precision on a twenty-minute download
 * invites the reader to watch it, and it is wrong anyway: the number is derived
 * from a rate that moves. Under a minute it says so and stops counting.
 */
export function formatEta(download: AsrDownload): string | null {
  const { total, loaded, bytesPerSecond } = download
  if (total <= 0 || bytesPerSecond <= 0 || loaded >= total) return null
  const seconds = (total - loaded) / bytesPerSecond
  if (seconds < 60) return t('voice.etaUnderMinute')
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return t('voice.etaMinutes', minutes)
  return t('voice.etaHours', Math.round(minutes / 6) / 10)
}

/** 0–100, and `null` while the file index has not landed yet. */
export function downloadPercent(download: AsrDownload): number | null {
  if (download.total <= 0) return null
  return Math.min(100, Math.round((download.loaded / download.total) * 100))
}

/**
 * Why a download stopped, as a sentence with a next step in it.
 *
 * The surface this replaces had exactly one: "O download falhou." — the same
 * four words for a full disk, a dropped connection and a model the repository
 * never published. The kind is carried across IPC precisely so this function
 * can exist.
 */
export function failureCopy(failure: AsrDownloadFailure | null): string {
  switch (failure?.kind) {
    case 'offline':
      return t('voice.failOffline')
    case 'server':
      return t('voice.failServer')
    case 'notFound':
      return t('voice.failNotFound')
    case 'disk':
      return t('voice.failDisk')
    case 'unsupported':
      return t('voice.failUnsupported')
    default:
      return t('voice.failUnknown')
  }
}

/**
 * Can the user usefully press "Tentar de novo"?
 *
 * A 404 and an unpublished precision will answer the same way next time, and
 * offering a retry that is guaranteed to fail is worse than saying nothing:
 * it spends the reader's attention on the one action that cannot help.
 */
export function isRetryable(failure: AsrDownloadFailure | null): boolean {
  return failure?.kind !== 'notFound' && failure?.kind !== 'unsupported'
}
