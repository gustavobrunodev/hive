import { useEffect, useRef, useState } from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Progress,
  ScrollArea,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  Spinner
} from '@hive/design-system'
import { relativeTimeLabel, t } from '../i18n'
import { HiveLogo } from './HiveLogo'
import { IconButton } from './IconButton'
import { Markdown } from './markdown'
import { CheckIcon, DownloadIcon, RefreshIcon } from './icons'
import { reduceUpdateEvent, type UpdateEventIn, type UpdateFlowState } from './updateFlow'

/** Structural mirror of `main/updateService.ts`'s `AppInfo` — the additive `skippedVersion` field (ND-R5.5) included, since that's the whole reason this file needs a fresh copy of the mirror rather than the pre-T13 one. */
interface AppInfo {
  name: string
  version: string
  updatesSupported: boolean
  canApply: boolean
  lastCheckedAt: number | null
  skippedVersion: string | null
}

interface UpdateCenterProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** `downloaded` state (ND-R4.3): the manual-open fallback when this platform has no apply strategy. Module-scope (not nested in `UpdateCenter`) purely to keep `renderVersionBlock`'s own cyclomatic complexity under the lint ceiling — no state of its own. */
function renderDownloaded(canApply: boolean): React.JSX.Element {
  return (
    <>
      <p className="wb-appset-status" data-tone="ok" role="status">
        <CheckIcon size={13} />
        {t('update.readyTitle')}
      </p>
      <p className="wb-appset-note">
        {canApply ? t('update.readyBody') : t('update.readyManualBody')}
      </p>
      <button
        type="button"
        className="wb-appset-btn wb-appset-btn-primary"
        onClick={() =>
          void (canApply ? window.hive.app.installUpdate() : window.hive.app.revealInstaller())
        }
      >
        {canApply ? t('update.restartCta') : t('update.openInstallerCta')}
      </button>
    </>
  )
}

/** `error` state: a distinct integrity message (ND-R3.3), shared generic recovery actions otherwise. Module-scope for the same complexity-budget reason as `renderDownloaded` above. */
function renderError(
  kind: 'network' | 'integrity' | 'apply',
  onRetry: () => void
): React.JSX.Element {
  return (
    <>
      <p className="wb-appset-status wb-appset-status-error" role="status">
        {kind === 'integrity' ? t('update.errorIntegrity') : t('update.errorGeneric')}
      </p>
      <div className="wb-appset-actions">
        <button type="button" className="wb-appset-btn" onClick={onRetry}>
          <RefreshIcon size={14} />
          {t('update.retryCta')}
        </button>
        <button
          type="button"
          className="wb-appset-btn"
          onClick={() => void window.hive.app.revealInstaller()}
        >
          {t('update.openInstallerCta')}
        </button>
      </div>
    </>
  )
}

/**
 * Tier 3 of design.md §5.1's three-tier escalation — "the deliberate visit."
 * Redesign of the former `AppSettingsSheet` (task T13): same left `Sheet`,
 * same trigger (the rail's gear), restructured into identity + a status line
 * that *reports* (not just a bare "Verificar" button) + the same version-
 * block state machine as `UpdateNotice` (roomier — reusing `updateFlow.ts`'s
 * reducer rather than duplicating the switch) + collapsed-by-default release
 * notes + skipped-version recovery + the preserved dev/unsupported note.
 *
 * Self-sufficient by design (own `window.hive.app.info()`/`onUpdateEvent()`
 * subscriptions, exactly like its predecessor) rather than fed by a shared
 * hook — T14 introduces `useUpdateFlow()` for `UpdateNotice`/the rail's dot/
 * the launch+periodic check policy, but none of those are `UpdateCenter`'s
 * own concern: it already gets everything it needs straight from the same
 * `onUpdateEvent` stream and `app:info`, and subscribing here for the whole
 * component's lifetime (not just while open) is exactly what let a download
 * started here keep progressing with the sheet closed, and reopening show
 * the flow exactly where it is — a second independent subscriber coexists
 * fine with `UpdateNotice`'s own (the main-side channel fans out to every
 * renderer-side listener regardless of how many `update:event:start` calls
 * registered it).
 */
export function UpdateCenter({ open, onOpenChange }: UpdateCenterProps): React.JSX.Element {
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [flow, setFlow] = useState<UpdateFlowState>({ status: 'idle' })
  // The last-seen release notes (only the `available` event ever carries
  // them) — kept alive through downloading/verifying/downloaded/applying/
  // error so the accordion doesn't blank out mid-journey, and cleared once
  // there's genuinely nothing pending to describe.
  const [notes, setNotes] = useState<string | null>(null)
  // "Instalar mesmo assim" (ND-R5.5): an explicit re-check, followed
  // automatically by the download once that check resolves to `available`
  // — one compound explicit action, not a background auto-download
  // (ND-R5.1 governs *unprompted* downloads; this one was asked for). Mirrored
  // in a ref alongside the state: the `onUpdateEvent` subscription below is
  // set up once (empty deps, so its subscription outlives the sheet being
  // opened/closed) and its callback is a closure formed at that one mount —
  // reading the *state* variable there would freeze it at its initial `false`
  // forever (a stale closure), never seeing `handleInstallSkipped`'s later
  // `true`. The ref is what the closure actually reads; the state is only
  // for the button's own `disabled` rendering.
  const [installingSkipped, setInstallingSkipped] = useState(false)
  const installingSkippedRef = useRef(false)

  function setInstallingSkippedBoth(value: boolean): void {
    installingSkippedRef.current = value
    setInstallingSkipped(value)
  }

  useEffect(() => {
    let cancelled = false
    window.hive.app.info().then((loaded) => {
      if (!cancelled) setInfo(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const unsubscribe = window.hive.app.onUpdateEvent((event: UpdateEventIn) => {
      const next = reduceUpdateEvent(event)
      setFlow(next)
      if (next.status === 'available') {
        setNotes(next.notes)
        if (installingSkippedRef.current) {
          setInstallingSkippedBoth(false)
          void window.hive.app.downloadUpdate()
        }
      } else if (next.status === 'idle' || next.status === 'upToDate') {
        setNotes(null)
      }
    })
    return unsubscribe
  }, [])

  function handleRefresh(): void {
    void window.hive.app.checkForUpdates()
  }

  function handleInstallSkipped(): void {
    setInstallingSkippedBoth(true)
    void window.hive.app.checkForUpdates()
  }

  function renderVersionBlock(): React.JSX.Element {
    switch (flow.status) {
      case 'idle':
      case 'upToDate':
        return (
          <>
            {flow.status === 'upToDate' && (
              <p className="wb-appset-status" data-tone="ok" role="status">
                <CheckIcon size={13} />
                {t('update.upToDateLabel')}
              </p>
            )}
          </>
        )
      case 'checking':
        return <Spinner label={t('update.checkingLabel')} />
      case 'available':
        return (
          <>
            <p className="wb-appset-status" role="status">
              {t('update.versionTransition', info?.version ?? '—', flow.version)}
            </p>
            <button
              type="button"
              className="wb-appset-btn wb-appset-btn-primary"
              onClick={() => void window.hive.app.downloadUpdate()}
            >
              <DownloadIcon size={14} />
              {t('update.updateNowCta')}
            </button>
          </>
        )
      case 'downloading':
        return (
          <div className="wb-appset-progress">
            <p className="wb-appset-status" role="status">
              {t('update.downloadProgress', flow.transferred, flow.total, flow.percent)}
            </p>
            <Progress value={flow.percent} aria-label={t('update.downloadProgressAria')} />
            <button
              type="button"
              className="wb-appset-btn"
              onClick={() => void window.hive.app.cancelUpdate()}
            >
              {t('update.cancelCta')}
            </button>
          </div>
        )
      case 'verifying':
        return (
          <div className="wb-appset-progress">
            <p className="wb-appset-status" role="status">
              {t('update.verifyingLabel')}
            </p>
            <Progress value={100} aria-label={t('update.verifyingLabel')} />
          </div>
        )
      case 'downloaded':
        return renderDownloaded(info?.canApply ?? false)
      case 'applying':
        return (
          <p className="wb-appset-status" role="status">
            {t('update.applyingLabel')}
          </p>
        )
      case 'error':
        return renderError(flow.kind, handleRefresh)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="wb-appset-sheet">
        <SheetTitle>{t('update.title')}</SheetTitle>
        <SheetDescription>{t('update.description')}</SheetDescription>

        <div className="wb-appset-identity">
          <HiveLogo mark="mark" className="wb-appset-logo" />
          <div className="wb-appset-identity-text">
            <span className="wb-appset-name">{t('app.title')}</span>
            {info !== null && (
              <span className="wb-appset-version">{t('update.versionLabel', info.version)}</span>
            )}
          </div>
        </div>

        {info !== null && !info.updatesSupported ? (
          <p className="wb-appset-note">{t('update.devNote')}</p>
        ) : (
          <>
            <div className="wb-appset-statusline">
              <span className="wb-appset-statusline-label">
                {info?.lastCheckedAt != null
                  ? t('update.lastCheckedLabel', relativeTimeLabel(info.lastCheckedAt))
                  : t('update.neverCheckedLabel')}
              </span>
              <IconButton label={t('update.refreshAria')} onClick={handleRefresh}>
                <RefreshIcon size={14} />
              </IconButton>
            </div>

            <div className="wb-appset-section">
              <h3 className="wb-appset-section-label">{t('update.updatesSectionLabel')}</h3>
              {renderVersionBlock()}
            </div>

            {notes !== null && (
              <Accordion type="single" collapsible className="wb-appset-notes">
                <AccordionItem value="notes">
                  <AccordionTrigger>{t('update.releaseNotesTrigger')}</AccordionTrigger>
                  <AccordionContent>
                    <ScrollArea className="wb-appset-notes-scroll">
                      <div className="wb-appset-notes-body wb-md">
                        <Markdown source={notes} />
                      </div>
                    </ScrollArea>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}

            {info?.skippedVersion != null && (
              <div className="wb-appset-skip-recovery">
                <span>{t('update.skippedVersionNote', info.skippedVersion)}</span>
                <button
                  type="button"
                  className="wb-appset-btn"
                  onClick={handleInstallSkipped}
                  disabled={installingSkipped}
                >
                  {t('update.installSkippedCta')}
                </button>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
