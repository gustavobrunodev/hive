import { useCallback, useState } from 'react'
import { t } from '../i18n'
import { AlertTriangleIcon, CheckCircleIcon, CloseIcon } from '../ui/icons'
import { failureCopy, isRetryable, type AsrDownload } from './downloadCopy'
import { useAsrDownloadEndings } from './useAsrDownloads'

/** One ending, held long enough to be read. */
interface Notice {
  key: number
  download: AsrDownload
}

/** How long a success sits there before it retires itself. */
const SUCCESS_MS = 9_000

export interface VoiceDownloadNoticesProps {
  /** Re-starts a download that stopped, resuming from its partial bytes. */
  onRetry: () => void
  /** Opens Perfil › Voz e transcrição. */
  onOpenSettings: () => void
}

/**
 * The answer to "and what if I'm not looking at the sheet?".
 *
 * A model download is the only job in this app that routinely outlives the
 * surface that started it: several minutes for 670 MB, during which the user
 * has certainly moved on. Before this, the ending had nowhere to go — the
 * download's only observer was a hook inside a sheet that had been unmounted,
 * so a completed download was silent and a failed one was invisible.
 *
 * So the ending is announced twice, by design and without duplication: here,
 * in the app, whenever Hive is on screen; and by the operating system's own
 * notification centre when it is not (main raises that one, and only while the
 * window is unfocused).
 *
 * Success retires itself; a failure does not. "It finished" needs no decision,
 * and a card that lingers after good news is clutter. "It stopped, and your
 * 400 MB is still on disk" needs one, and dismissing it is that decision.
 *
 * The success card lost its action in M29. It used to offer "Usar <modelo>",
 * which pinned the finished download as the one to transcribe with — an
 * offer that only meant something while there were ten models to be pinned
 * among. Now the news *is* the whole message.
 */
export function VoiceDownloadNotices({
  onRetry,
  onOpenSettings
}: VoiceDownloadNoticesProps): React.JSX.Element | null {
  const [notices, setNotices] = useState<Notice[]>([])

  const drop = useCallback((key: number) => {
    setNotices((current) => current.filter((notice) => notice.key !== key))
  }, [])

  useAsrDownloadEndings(
    useCallback(
      (download) => {
        // A cancel was the user's own doing, a second ago, by hand. Announcing
        // it back to them is the app narrating their own click.
        if (download.status === 'cancelled') return
        const key = Date.now() + Math.random()
        setNotices((current) => [
          ...current.filter((n) => n.download.id !== download.id),
          { key, download }
        ])
        if (download.status === 'done') setTimeout(() => drop(key), SUCCESS_MS)
      },
      [drop]
    )
  )

  if (notices.length === 0) return null

  return (
    <div className="wb-vnotices">
      {notices.map(({ key, download }) => {
        const ok = download.status === 'done'
        return (
          <div
            key={key}
            className="wb-vnotice"
            data-tone={ok ? 'success' : 'danger'}
            role={ok ? 'status' : 'alert'}
          >
            <span className="wb-vnotice-mark" aria-hidden="true">
              {ok ? <CheckCircleIcon size={16} /> : <AlertTriangleIcon size={16} />}
            </span>
            <div className="wb-vnotice-body">
              <p className="wb-vnotice-title">
                {ok ? t('voice.noticeDoneTitle') : t('voice.noticeFailTitle')}
              </p>
              <p className="wb-vnotice-text">
                {ok ? t('voice.noticeDoneText') : failureCopy(download.failure)}
              </p>
              <div className="wb-vnotice-actions">
                {!ok && (
                  <>
                    {isRetryable(download.failure) && (
                      <button
                        type="button"
                        className="wb-vbtn"
                        onClick={() => {
                          onRetry()
                          drop(key)
                        }}
                      >
                        {download.loaded > 0 ? t('voice.downloadResume') : t('voice.downloadRetry')}
                      </button>
                    )}
                    <button type="button" className="wb-vlink" onClick={onOpenSettings}>
                      {t('voice.noticeOpenSettings')}
                    </button>
                  </>
                )}
              </div>
            </div>
            <button
              type="button"
              className="wb-vicon-btn wb-vnotice-close"
              aria-label={t('voice.noticeDismissAria')}
              onClick={() => drop(key)}
            >
              <CloseIcon size={13} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
