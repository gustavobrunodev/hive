import { t } from '../i18n'
import { CloseIcon } from '../ui/icons'
import {
  downloadPercent,
  failureCopy,
  formatBytes,
  formatEta,
  formatRate,
  isRetryable,
  type WhisperDownload
} from './downloadCopy'

/**
 * A download in flight, as a download manager shows one.
 *
 * Everything here exists because the surface it replaces had none of it: a bare
 * percentage, updated once per *file*. On `medium` — two files, 2.8 GB — that
 * meant 0 %, then 42 %, then done, over twenty-odd minutes. A number that does
 * not move is read as a hang, and "it failed" is what a hang gets reported as.
 *
 * So the row states four things a stalled bar cannot: how much has arrived, how
 * much there is, how fast it is going, and how much longer. The rate and the
 * remaining time drop out silently before there is enough evidence to state
 * them, rather than showing a confident zero.
 */
export function DownloadProgress({
  download,
  onCancel
}: {
  download: WhisperDownload
  onCancel: () => void
}): React.JSX.Element {
  const pct = downloadPercent(download)
  const rate = formatRate(download.bytesPerSecond)
  const eta = formatEta(download)

  return (
    <div className="wb-vdl">
      <div className="wb-vdl-head">
        <span className="wb-vdl-numbers">
          {pct === null
            ? t('voice.downloadStarting')
            : t('voice.downloadOf', formatBytes(download.loaded), formatBytes(download.total))}
        </span>
        <span className="wb-vdl-pct">{pct === null ? '' : t('voice.percent', pct)}</span>
      </div>
      <div
        className="wb-vdl-track"
        role="progressbar"
        aria-valuenow={pct ?? undefined}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t('voice.downloadingAria', download.id, pct ?? 0)}
        data-indeterminate={pct === null || undefined}
      >
        <span className="wb-vdl-fill" style={pct === null ? undefined : { width: `${pct}%` }} />
      </div>
      <div className="wb-vdl-foot">
        <span className="wb-vdl-meta">
          {rate !== null && <span className="wb-vdl-rate">{rate}</span>}
          {eta !== null && <span className="wb-vdl-eta">{eta}</span>}
        </span>
        <button
          type="button"
          className="wb-vlink wb-vlink-quiet"
          onClick={onCancel}
          aria-label={t('voice.downloadCancelAria', download.id)}
        >
          {t('voice.downloadCancel')}
        </button>
      </div>
    </div>
  )
}

/**
 * A download that stopped, with the reason and the one useful next step.
 *
 * The retry is offered **only when retrying could work**: a 404 or a precision
 * the repository never published will answer the same way next time, and a
 * button that is guaranteed to fail spends the reader's attention on the one
 * action that cannot help them.
 *
 * "Continuar" rather than "Baixar" wherever bytes survived, because that is
 * what actually happens — the temp directory is kept and the next attempt sends
 * a `Range` from where it stopped.
 */
export function DownloadFailure({
  download,
  onRetry,
  onDismiss
}: {
  download: WhisperDownload
  onRetry: () => void
  onDismiss: () => void
}): React.JSX.Element {
  const resumable = download.loaded > 0
  return (
    <div className="wb-vfail" role="alert">
      <p className="wb-vfail-text">
        {failureCopy(download.failure)}
        {resumable && (
          <span className="wb-vfail-resume">
            {t('voice.failResumeFrom', formatBytes(download.loaded))}
          </span>
        )}
      </p>
      <div className="wb-vfail-actions">
        {isRetryable(download.failure) && (
          <button type="button" className="wb-vbtn" onClick={onRetry}>
            {resumable ? t('voice.downloadResume') : t('voice.downloadRetry')}
          </button>
        )}
        <button
          type="button"
          className="wb-vicon-btn"
          aria-label={t('voice.dismissFailureAria', download.id)}
          onClick={onDismiss}
        >
          <CloseIcon size={13} />
        </button>
      </div>
    </div>
  )
}
