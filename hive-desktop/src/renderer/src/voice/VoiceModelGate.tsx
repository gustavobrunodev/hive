import { useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@hive/design-system'
import { t } from '../i18n'
import { DownloadIcon, MicIcon } from '../ui/icons'
import { DownloadFailure, DownloadProgress } from './DownloadProgress'
import { formatMegabytes } from './downloadCopy'
import { useAsrDownloads } from './useAsrDownloads'
import { useAsrReadiness } from './useAsrReadiness'

export interface VoiceModelGateProps {
  open: boolean
  /**
   * Closing forgets the remembered intent; `useVoiceGate` closes this itself
   * the moment the model lands, and runs the take the user originally asked for.
   */
  onOpenChange: (open: boolean) => void
  /** Opens Perfil › Voz e transcrição, for the reader who wants the details. */
  onOpenSettings: () => void
}

/**
 * The gate every recording surface passes through when the model is missing.
 *
 * **It is a way in, not a wall.** The app ships no weights, so pressing the
 * microphone on a fresh install has no honest outcome — the alternative to this
 * dialog is a take that records happily and then fails at transcription,
 * minutes of speech later, with the download the user actually needed hidden
 * three levels deep in a settings sheet.
 *
 * So the dialog does the whole job in place: it states the size, downloads it
 * here, and then **starts the take the user originally asked for** —
 * `useVoiceGate` remembers the request across the wait rather than throwing it
 * away with the dialog.
 *
 * **What M29 deleted from this file is the interesting part.** It used to open
 * with a choice: the three lightest multilingual models this machine could
 * load, each with an accuracy/speed meter and a size, plus a recommendation
 * explaining the pick. That chooser existed because Whisper made every user
 * personally resolve a trade the app could not resolve for them — fast and
 * wrong, or accurate and too big. One model that is both removes the question,
 * and the best version of a choice nobody should have to make is its absence.
 *
 * A modal, which the product register calls laziness by default — earned here
 * because it is the one case where the user's action genuinely cannot proceed,
 * and answering it inline would mean growing a downloader inside the chat
 * composer and inside the ingestion sheet, twice.
 */
export function VoiceModelGate({
  open,
  onOpenChange,
  onOpenSettings
}: VoiceModelGateProps): React.JSX.Element | null {
  const { readiness, refresh } = useAsrReadiness(open)
  const downloads = useAsrDownloads()

  const model = readiness?.model
  const download = model ? downloads.byId[model.id] : undefined
  const running = download?.status === 'downloading'

  // A finished download does not re-resolve readiness on its own — main answers
  // `asr:readiness` on request, so the request has to be made. Keyed on the
  // stable callback, never on the hook's own object: that is a fresh object
  // every render, and an effect keyed on it would re-open this subscription on
  // every frame.
  useEffect(() => {
    if (!open) return
    return window.hive.asr.onDownloadSettled((settled) => {
      if (settled.status === 'done') refresh()
    })
  }, [open, refresh])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="wb-vgate">
        <span className="wb-vgate-mark" aria-hidden="true">
          <MicIcon size={22} />
        </span>
        <DialogTitle className="wb-vgate-title">{t('voiceGate.title')}</DialogTitle>
        <DialogDescription className="wb-vgate-desc">
          {t('voiceGate.description')}
        </DialogDescription>

        {model === undefined ? (
          <p className="wb-machine-measuring">{t('voice.machineMeasuring')}</p>
        ) : (
          <>
            {running && download && (
              <DownloadProgress download={download} onCancel={() => downloads.cancel(model.id)} />
            )}
            {download?.status === 'error' && (
              <DownloadFailure
                download={download}
                onRetry={downloads.start}
                onDismiss={() => downloads.dismiss(model.id)}
              />
            )}

            <div className="wb-vgate-actions">
              {!running && (
                <button
                  type="button"
                  className="wb-vbtn wb-vbtn-primary wb-vbtn-wide"
                  onClick={downloads.start}
                >
                  <DownloadIcon size={14} aria-hidden="true" />
                  {t('voiceGate.downloadCta', formatMegabytes(model.sizeMB))}
                </button>
              )}
              <p className="wb-vgate-foot">
                {running ? t('voiceGate.keepsGoing') : t('voiceGate.onceOnly')}
                <button type="button" className="wb-vlink" onClick={onOpenSettings}>
                  {t('voiceGate.settingsCta')}
                </button>
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
