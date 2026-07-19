import { useEffect, useState } from 'react'
import {
  Progress,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  Spinner
} from '@hive/design-system'
import { t } from '../i18n'
import { HiveLogo } from './HiveLogo'
import { CheckIcon, DownloadIcon, RefreshIcon } from './icons'

/** Structural mirror of `main/updateService.ts`'s `AppInfo`. */
interface AppInfo {
  name: string
  version: string
  updatesSupported: boolean
}

/** Structural mirror of `main/updateService.ts`'s `UpdateEvent`. */
type UpdateEventIn =
  | { type: 'checking' }
  | { type: 'not-available' }
  | { type: 'available'; version: string }
  | { type: 'progress'; percent: number }
  | { type: 'downloaded'; version: string }
  | { type: 'error'; message: string }

/** The update flow's renderer-side state machine, driven by the event stream. */
type UpdateState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'upToDate' }
  | { status: 'available'; version: string }
  | { status: 'downloading'; percent: number }
  | { status: 'downloaded'; version: string }
  | { status: 'error' }

interface AppSettingsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function reduceUpdateEvent(event: UpdateEventIn): UpdateState {
  switch (event.type) {
    case 'checking':
      return { status: 'checking' }
    case 'not-available':
      return { status: 'upToDate' }
    case 'available':
      return { status: 'available', version: event.version }
    case 'progress':
      return { status: 'downloading', percent: event.percent }
    case 'downloaded':
      return { status: 'downloaded', version: event.version }
    case 'error':
      return { status: 'error' }
  }
}

/**
 * App settings (the bottom-left gear) — the *software* side of settings,
 * deliberately separate from the profile sheet (who you are) in the top bar:
 * what's installed (name + version) and the user-driven self-update flow
 * (check → download with progress → restart & install). A left-side `Sheet`,
 * anchored to the same edge as its trigger. In dev / unpacked builds
 * (`updatesSupported` false) the flow is replaced by an honest note instead
 * of a button that can't work.
 */
export function AppSettingsSheet({
  open,
  onOpenChange
}: AppSettingsSheetProps): React.JSX.Element {
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [update, setUpdate] = useState<UpdateState>({ status: 'idle' })

  useEffect(() => {
    let cancelled = false
    window.hive.app.info().then((loaded) => {
      if (!cancelled) setInfo(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Subscribe for the sheet's lifetime (not just while open): a download
  // started here keeps progressing with the sheet closed, and reopening
  // shows the flow exactly where it is.
  useEffect(() => {
    const unsubscribe = window.hive.app.onUpdateEvent((event) => {
      setUpdate(reduceUpdateEvent(event))
    })
    return unsubscribe
  }, [])

  // Nested so the six-state switch stays off the component's complexity
  // budget (the repo's renderToolbar pattern).
  function renderUpdateFlow(): React.JSX.Element {
    if (info !== null && !info.updatesSupported) {
      return <p className="wb-appset-note">{t('appSettings.devNote')}</p>
    }
    switch (update.status) {
      case 'idle':
      case 'upToDate':
      case 'error':
        return (
          <>
            {update.status === 'upToDate' && (
              <p className="wb-appset-status" data-tone="ok" role="status">
                <CheckIcon size={13} />
                {t('appSettings.upToDateLabel')}
              </p>
            )}
            {update.status === 'error' && (
              <p className="wb-appset-status" data-tone="error" role="status">
                {t('appSettings.errorLabel')}
              </p>
            )}
            <button
              type="button"
              className="wb-appset-btn"
              onClick={() => void window.hive.app.checkForUpdates()}
            >
              <RefreshIcon size={14} />
              {update.status === 'error' ? t('appSettings.retryCta') : t('appSettings.checkCta')}
            </button>
          </>
        )
      case 'checking':
        return <Spinner label={t('appSettings.checkingLabel')} />
      case 'available':
        return (
          <>
            <p className="wb-appset-status" role="status">
              {t('appSettings.availableLabel', update.version)}
            </p>
            <button
              type="button"
              className="wb-appset-btn wb-appset-btn-primary"
              onClick={() => void window.hive.app.downloadUpdate()}
            >
              <DownloadIcon size={14} />
              {t('appSettings.downloadCta')}
            </button>
          </>
        )
      case 'downloading':
        return (
          <div className="wb-appset-progress">
            <p className="wb-appset-status" role="status">
              {t('appSettings.downloadingLabel')}
            </p>
            <Progress
              value={update.percent}
              aria-label={t('appSettings.downloadProgressAria')}
            />
          </div>
        )
      case 'downloaded':
        return (
          <>
            <p className="wb-appset-status" data-tone="ok" role="status">
              <CheckIcon size={13} />
              {t('appSettings.downloadedLabel', update.version)}
            </p>
            <button
              type="button"
              className="wb-appset-btn wb-appset-btn-primary"
              onClick={() => void window.hive.app.installUpdate()}
            >
              {t('appSettings.restartCta')}
            </button>
          </>
        )
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="wb-appset-sheet">
        <SheetTitle>{t('appSettings.title')}</SheetTitle>
        <SheetDescription>{t('appSettings.description')}</SheetDescription>

        <div className="wb-appset-identity">
          <HiveLogo mark="brain" className="wb-appset-logo" />
          <div className="wb-appset-identity-text">
            <span className="wb-appset-name">{t('app.title')}</span>
            {info !== null && (
              <span className="wb-appset-version">{t('appSettings.versionLabel', info.version)}</span>
            )}
          </div>
        </div>

        <div className="wb-appset-section">
          <h3 className="wb-appset-section-label">{t('appSettings.updatesSectionLabel')}</h3>
          {renderUpdateFlow()}
        </div>
      </SheetContent>
    </Sheet>
  )
}
